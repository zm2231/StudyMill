CREATE TABLE IF NOT EXISTS user_ai_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  default_provider TEXT NOT NULL DEFAULT 'google' CHECK (default_provider IN ('google','openai','openrouter')),
  use_gateway INTEGER NOT NULL DEFAULT 1,
  keys_json TEXT,
  envelope_ver TEXT NOT NULL DEFAULT 'v1',
  kdf_alg TEXT NOT NULL DEFAULT 'HKDF-SHA256',
  enc_alg TEXT NOT NULL DEFAULT 'AES-GCM',
  salt_b64u TEXT NOT NULL,
  key_id TEXT NOT NULL,
  provider_models TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS update_user_ai_preferences_updated_at
AFTER UPDATE ON user_ai_preferences
BEGIN
  UPDATE user_ai_preferences SET updated_at = CURRENT_TIMESTAMP WHERE user_id = NEW.user_id;
END;

