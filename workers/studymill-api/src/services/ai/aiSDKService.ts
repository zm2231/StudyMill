import { JsonToSseTransformStream, UI_MESSAGE_STREAM_HEADERS } from 'ai';
import type OpenAI from 'openai';
import { z } from 'zod';
import { createOpenAICompatClient } from './providers';

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
};

type StreamChatParams = {
  userId: string;
  messages: ChatMessage[];
  system?: string;
  modelOverride?: string;
  providerOverride?: string; // kept for backward compatibility (ignored)
  byokKey?: string | null;
  signal?: AbortSignal;
};

type StreamChatContext = {
  env: Bindings;
  db: D1Database;
};

type StreamChatResult = {
  textStream: AsyncIterable<string>;
  getModel: () => string;
  didFallback: () => boolean;
  finalResponse: () => Promise<OpenAI.Chat.Completions.ChatCompletion | null>;
  cancel: () => void;
};

function isHardClientError(err: unknown) {
  if (!err || typeof err !== 'object') return false;
  const status = (err as any)?.status ?? (err as any)?.response?.status;
  if (typeof status === 'number') {
    return status > 0 && status < 500;
  }
  return false;
}

type RunModelOptions = {
  client: OpenAI;
  model: string;
  messages: ChatMessage[];
};

type ModelStream = {
  iterator: AsyncIterable<string>;
  responsePromise: Promise<OpenAI.Chat.Completions.ChatCompletion | null>;
  abort: () => void;
};

async function createModelStream(opts: RunModelOptions): Promise<ModelStream> {
  const { client, model, messages } = opts;
  const stream = await client.chat.completions.create({
    model,
    messages,
    stream: true,
  });

  const iterator = (async function* () {
    for await (const part of stream) {
      const delta = part?.choices?.[0]?.delta?.content;
      if (delta) {
        yield delta;
      }
    }
  })();

  const responsePromise = stream?.response?.catch?.(() => null) ?? Promise.resolve(null);
  const abort = () => {
    try {
      stream?.controller?.abort();
    } catch {}
  };

  return { iterator, responsePromise, abort };
}

function createChatStream(
  client: OpenAI,
  env: Bindings,
  messages: ChatMessage[],
  options: { modelOverride?: string; signal?: AbortSignal }
): StreamChatResult {
  const primaryModel = options.modelOverride || env.AIG_DEFAULT_MODEL;
  const fallbackModel = env.AIG_FALLBACK_MODEL;

  let modelUsed = primaryModel;
  let fallbackTriggered = false;
  let finalResponsePromise: Promise<OpenAI.Chat.Completions.ChatCompletion | null> = Promise.resolve(null);
  const activeAborts: Array<() => void> = [];

  const runModel = async (model: string) => {
    const stream = await createModelStream({ client, model, messages });
    finalResponsePromise = stream.responsePromise;
    activeAborts.push(stream.abort);
    return stream.iterator;
  };

  const textStream = (async function* () {
    try {
      const iterator = await runModel(primaryModel);
      for await (const chunk of iterator) {
        if (options.signal?.aborted) {
          throw new Error('aborted');
        }
        yield chunk;
      }
    } catch (err) {
      if (isHardClientError(err)) {
        throw err;
      }
      fallbackTriggered = true;
      modelUsed = fallbackModel;
      const iterator = await runModel(fallbackModel);
      for await (const chunk of iterator) {
        if (options.signal?.aborted) {
          throw new Error('aborted');
        }
        yield chunk;
      }
    }
  })();

  const cancel = () => {
    for (const abort of activeAborts) {
      try {
        abort();
      } catch {}
    }
  };

  return {
    textStream,
    getModel: () => modelUsed,
    didFallback: () => fallbackTriggered,
    finalResponse: () => finalResponsePromise,
    cancel,
  };
}

export async function streamChat(params: StreamChatParams, ctx: StreamChatContext): Promise<StreamChatResult> {
  const { env } = ctx;
  const client = createOpenAICompatClient(env, { userProviderKey: params.byokKey ?? null });

  const messageList: ChatMessage[] = [];
  if (params.system) {
    messageList.push({ role: 'system', content: params.system });
  }
  messageList.push(...params.messages);

  return createChatStream(client, env, messageList, {
    modelOverride: params.modelOverride,
    signal: params.signal,
  });
}

type SSEHooks = {
  onToken?: (token: string) => void | Promise<void>;
  onFinal?: (fullText: string) => void | Promise<void>;
  onError?: (error: unknown) => void | Promise<void>;
  signal?: AbortSignal;
};

export async function toSSEStream(result: StreamChatResult, hooks: SSEHooks = {}): Promise<Response> {
  const streamId = crypto.randomUUID();
  const textStream = result.textStream;

  const jsonStream = new ReadableStream<any>({
    start(controller) {
      let full = '';
      let closed = false;

      const emit = (part: any) => {
        try {
          controller.enqueue(part);
        } catch {}
      };

      const abortHandler = () => {
        if (closed) return;
        result.cancel();
        closed = true;
        try {
          controller.error(new Error('aborted'));
        } catch {}
      };

      if (hooks.signal) {
        if (hooks.signal.aborted) {
          abortHandler();
          return;
        }
        hooks.signal.addEventListener('abort', abortHandler, { once: true });
      }

      emit({ type: 'text-start', id: streamId });

      (async () => {
        try {
          for await (const token of textStream) {
            full += token;
            await hooks.onToken?.(token);
            emit({ type: 'text-delta', id: streamId, text: token });
          }

          if (closed) return;

          await hooks.onFinal?.(full);
          emit({ type: 'text-end', id: streamId });
          closed = true;
          controller.close();
        } catch (err) {
          await hooks.onError?.(err);
          closed = true;
          try {
            controller.error(err ?? new Error('stream-error'));
          } catch {}
        } finally {
          hooks.signal?.removeEventListener('abort', abortHandler);
        }
      })();
    },
    cancel() {
      result.cancel();
    },
  });

  const sseStream = jsonStream
    .pipeThrough(new JsonToSseTransformStream())
    .pipeThrough(new TransformStream<string, Uint8Array>({
      transform(chunk, controller) {
        controller.enqueue(new TextEncoder().encode(chunk));
      },
    }));

  const headers = new Headers(UI_MESSAGE_STREAM_HEADERS);
  headers.set('Cache-Control', 'no-cache, no-transform');
  headers.set('Connection', 'keep-alive');

  return new Response(sseStream, {
    headers,
  });
}

export async function streamObject(
  params: {
    userId: string;
    system?: string;
    modelOverride?: string;
    providerOverride?: string;
    byokKey?: string | null;
    signal?: AbortSignal;
    prompt: string;
  },
  schema: z.ZodTypeAny,
  ctx: StreamChatContext
) {
  const client = createOpenAICompatClient(ctx.env, { userProviderKey: params.byokKey ?? null });
  const model = params.modelOverride || ctx.env.AIG_DEFAULT_MODEL;
  const messages: ChatMessage[] = [];
  if (params.system) {
    messages.push({ role: 'system', content: params.system });
  }
  messages.push({ role: 'user', content: params.prompt });

  const response = await client.chat.completions.create({
    model,
    messages,
    stream: false,
  });

  const text = response.choices?.[0]?.message?.content ?? '';
  const parsed = schema.parse(text ? JSON.parse(text) : {});
  return parsed;
}
