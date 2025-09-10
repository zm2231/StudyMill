export {};

declare global {
  interface Bindings {
    DB: D1Database;

    // Phase 0 secrets and vars
    AI_PREFS_MASTER_KEY: string;
    AI_GATEWAY_TOKEN: string;
    OPENAI_API_KEY?: string;
    GEMINI_API_KEY?: string;
    GOOGLE_API_KEY?: string; // legacy fallback only
    OPENROUTER_API_KEY?: string;

    // AI Gateway base URLs (vars)
    AI_GATEWAY_OPENAI_BASE_URL?: string;
    AI_GATEWAY_GOOGLE_BASE_URL?: string;
    AI_GATEWAY_OPENROUTER_BASE_URL?: string;
  }
}

