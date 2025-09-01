import { GoogleGenerativeAI, type GenerativeModel, type GenerateContentResult } from "@google/generative-ai";

export type ChatRole = "user" | "assistant" | "model" | "system";

export interface ChatHistoryMessage {
  role: ChatRole;
  content: string;
}

export interface StreamOptions {
  systemPrompt?: string;
  history?: ChatHistoryMessage[];
  userText: string;
  generationConfig?: {
    temperature?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens?: number;
  };
}

export class GenAIService {
  private genAI: GoogleGenerativeAI;
  private modelName: string;

  constructor(apiKey: string, modelName = "gemini-2.5-flash") {
    if (!apiKey || apiKey.trim().length === 0) {
      throw new Error("Google Generative AI API key is required");
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.modelName = modelName;
  }

  private getModel(systemPrompt?: string): GenerativeModel {
    // Note: systemInstruction is supported in recent SDKs; if not available,
    // we inject it as the first history message below.
    try {
      return this.genAI.getGenerativeModel({
        model: this.modelName,
        ...(systemPrompt ? { systemInstruction: { parts: [{ text: systemPrompt }] } } : {}) as any,
      });
    } catch {
      return this.genAI.getGenerativeModel({ model: this.modelName });
    }
  }

  async streamChat(opts: StreamOptions, onChunk: (text: string) => void): Promise<string> {
    const { systemPrompt, history = [], userText, generationConfig } = opts;

    const model = this.getModel(systemPrompt);

    // Convert history to SDK format. If systemPrompt couldn't be set via systemInstruction,
    // include it as a first system message in history.
    const historyParts = [] as { role: string; parts: { text: string }[] }[];

    if (systemPrompt) {
      // Add as a system message for full compatibility even if systemInstruction works.
      historyParts.push({ role: "system", parts: [{ text: systemPrompt }] });
    }

    for (const msg of history) {
      const role = msg.role === "assistant" ? "model" : msg.role; // SDK uses "model"
      historyParts.push({ role, parts: [{ text: msg.content }] });
    }

    const chat = model.startChat({
      history: historyParts,
      generationConfig: {
        temperature: generationConfig?.temperature ?? 0.7,
        topP: generationConfig?.topP ?? 0.9,
        topK: generationConfig?.topK ?? 40,
        maxOutputTokens: generationConfig?.maxOutputTokens ?? 8192,
      },
    } as any);

    const result = await (chat as any).sendMessageStream(userText);

    let full = "";
    // Stream chunks as they arrive
    for await (const chunk of result.stream) {
      const text = chunk?.text?.() ?? "";
      if (text) {
        full += text;
        onChunk(text);
      }
    }

    // Ensure we await the final aggregated response (some SDKs finalize additional tokens)
    const finalResponse: GenerateContentResult = await result.response;
    const finalText = finalResponse?.response?.text?.() ?? finalResponse?.text?.() ?? full;
    return finalText || full;
  }

  async generateText(prompt: string, systemPrompt?: string, generationConfig?: StreamOptions["generationConfig"]): Promise<string> {
    const model = this.getModel(systemPrompt);
    const res = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: generationConfig?.temperature ?? 0.7,
        topP: generationConfig?.topP ?? 0.9,
        topK: generationConfig?.topK ?? 40,
        maxOutputTokens: generationConfig?.maxOutputTokens ?? 4096,
      },
    } as any);

    return res?.response?.text?.() ?? "";
  }
}

