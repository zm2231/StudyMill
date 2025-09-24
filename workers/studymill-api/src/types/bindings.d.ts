export {};

declare global {
  interface Bindings {
    DB: D1Database;

    // Phase 0 secrets and vars
    AI_PREFS_MASTER_KEY: string;
    AI_GATEWAY_TOKEN?: string;
    OPENAI_API_KEY?: string;
    GEMINI_API_KEY?: string;
    GOOGLE_API_KEY?: string; // legacy fallback only
    OPENROUTER_API_KEY?: string;

    // AI Gateway OpenAI-compat configuration
    AIG_BASE_URL: string;
    AIG_DEFAULT_MODEL: string;
    AIG_FALLBACK_MODEL: string;
    AIGATEWAY_USE_BINDING?: string; // "true" when Worker binding handles auth

    // Diagnostics
    DIAGNOSTICS_TOKEN?: string;
    DIAGNOSTICS_ENABLE?: string; // '1' to enable in prod
  }
}
