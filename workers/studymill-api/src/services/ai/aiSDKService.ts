import { JsonToSseTransformStream, UI_MESSAGE_STREAM_HEADERS } from 'ai';
import { z } from 'zod';
import { gatewayOpenAICompatFetch } from './providers';

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

type ChatCompletionFinal = {
  text: string;
  raw?: unknown;
};

type StreamChatResult = {
  textStream: AsyncIterable<string>;
  getModel: () => string;
  didFallback: () => boolean;
  finalResponse: () => Promise<ChatCompletionFinal | null>;
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
  env: Bindings;
  model: string;
  messages: ChatMessage[];
};

type ModelStream = {
  iterator: AsyncIterable<string>;
  responsePromise: Promise<ChatCompletionFinal | null>;
  abort: () => void;
};

function createDeferred<T>() {
  let settled = false;
  let resolveFn: (value: T) => void = () => {};
  let rejectFn: (reason?: unknown) => void = () => {};
  const promise = new Promise<T>((resolve, reject) => {
    resolveFn = (value) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };
    rejectFn = (reason) => {
      if (!settled) {
        settled = true;
        reject(reason);
      }
    };
  });

  return {
    promise,
    resolve: resolveFn,
    reject: rejectFn,
    isSettled: () => settled,
  };
}

async function createModelStream(opts: RunModelOptions): Promise<ModelStream> {
  const { env, model, messages } = opts;
  const response = await gatewayOpenAICompatFetch(env, 'chat/completions', {
    model,
    messages,
    stream: true,
  });

  if (!response.ok) {
    throw new Error(`Gateway request failed with status ${response.status}`);
  }

  if (!response.body) {
    throw new Error('Gateway response missing body stream');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  const deferred = createDeferred<ChatCompletionFinal | null>();

  const tokens: string[] = [];
  let buffer = '';
  let aggregatedText = '';
  let finalPayload: unknown = null;
  let done = false;

  const flushEvents = () => {
    let index: number;
    while ((index = buffer.indexOf('\n\n')) !== -1) {
      const rawEvent = buffer.slice(0, index);
      buffer = buffer.slice(index + 2);
      const dataLines = rawEvent
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim());

      if (dataLines.length === 0) continue;

      const dataStr = dataLines.join('\n');
      if (!dataStr) continue;
      if (dataStr === '[DONE]') {
        done = true;
        continue;
      }

      let payload: any;
      try {
        payload = JSON.parse(dataStr);
      } catch {
        continue;
      }

      const choice = payload?.choices?.[0];
      if (!choice) continue;

      const delta = choice?.delta?.content;
      if (typeof delta === 'string' && delta.length > 0) {
        tokens.push(delta);
        aggregatedText += delta;
      }

      if (!finalPayload && choice?.finish_reason) {
        finalPayload = payload;
      }
    }
  };

  const iterator = (async function* () {
    try {
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        if (readerDone) {
          done = true;
        } else if (value) {
          buffer += decoder.decode(value, { stream: true });
          flushEvents();
        }

        while (tokens.length > 0) {
          yield tokens.shift() as string;
        }

        if (done) break;
      }

      if (buffer) {
        buffer += decoder.decode(new Uint8Array(), { stream: false });
        flushEvents();
        while (tokens.length > 0) {
          yield tokens.shift() as string;
        }
      }

      if (!deferred.isSettled()) {
        deferred.resolve({ text: aggregatedText, raw: finalPayload ?? null });
      }
    } catch (err) {
      if (!deferred.isSettled()) {
        deferred.reject(err);
      }
      throw err;
    } finally {
      try {
        reader.releaseLock();
      } catch {}
    }
  })();

  const abort = () => {
    try {
      reader.cancel().catch(() => {});
    } catch {}
  };

  return {
    iterator,
    responsePromise: deferred.promise,
    abort,
  };
}

function createChatStream(
  env: Bindings,
  messages: ChatMessage[],
  options: { modelOverride?: string; signal?: AbortSignal }
): StreamChatResult {
  const primaryModel = options.modelOverride || env.AIG_DEFAULT_MODEL;
  const fallbackModel = env.AIG_FALLBACK_MODEL;

  let modelUsed = primaryModel;
  let fallbackTriggered = false;
  let finalResponsePromise: Promise<ChatCompletionFinal | null> = Promise.resolve(null);
  const activeAborts: Array<() => void> = [];

  const runModel = async (model: string) => {
    const stream = await createModelStream({ env, model, messages });
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
  const messageList: ChatMessage[] = [];
  if (params.system) {
    messageList.push({ role: 'system', content: params.system });
  }
  messageList.push(...params.messages);

  const byokKey = params.byokKey?.trim();
  if (byokKey) {
    console.warn('[streamChat] Ignoring BYOK key in managed gateway mode');
  }

  return createChatStream(env, messageList, {
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
  const model = params.modelOverride || ctx.env.AIG_DEFAULT_MODEL;
  const messages: ChatMessage[] = [];
  if (params.system) {
    messages.push({ role: 'system', content: params.system });
  }
  messages.push({ role: 'user', content: params.prompt });

  const response = await gatewayOpenAICompatFetch(ctx.env, 'chat/completions', {
    model,
    messages,
    stream: false,
  });

  if (!response.ok) {
    throw new Error(`Gateway request failed with status ${response.status}`);
  }

  const data = await response.json<any>();
  const text = data?.choices?.[0]?.message?.content ?? '';
  const parsed = schema.parse(text ? JSON.parse(text) : {});
  return parsed;
}
