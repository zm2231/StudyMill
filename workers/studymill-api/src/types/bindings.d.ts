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
    AI_GATEWAY_COMPAT_BASE_URL?: string;
    // Dynamic routing flags
    AI_GATEWAY_DYNAMIC_ENABLE?: string; // '1' to enable
    AI_GATEWAY_DYNAMIC_ROUTE?: string; // route name, e.g. 'gemini' or 'default'

    // Diagnostics
    DIAGNOSTICS_TOKEN?: string;
    DIAGNOSTICS_ENABLE?: string; // '1' to enable in prod
  }
}

