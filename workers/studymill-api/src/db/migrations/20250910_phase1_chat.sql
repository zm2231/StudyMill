-- Phase 1 Chat Migration
-- Augment chat_sessions and chat_messages for resumables

-- chat_sessions additions
ALTER TABLE chat_sessions ADD COLUMN provider TEXT;       -- 'google' | 'openai' | 'openrouter'
ALTER TABLE chat_sessions ADD COLUMN model_id TEXT;       -- model identifier
ALTER TABLE chat_sessions ADD COLUMN generation_id TEXT;  -- latest inflight generation
ALTER TABLE chat_sessions ADD COLUMN parent_session_id TEXT;
ALTER TABLE chat_sessions ADD COLUMN branch_from_msg_index INTEGER;

CREATE INDEX IF NOT EXISTS ix_sessions_user_created ON chat_sessions(user_id, created_at);

-- chat_messages additions
ALTER TABLE chat_messages ADD COLUMN generation_id TEXT;   -- ties deltas/final to a run
ALTER TABLE chat_messages ADD COLUMN msg_index INTEGER;    -- sequence index within session

CREATE INDEX IF NOT EXISTS ix_msgs_index ON chat_messages(session_id, msg_index);
CREATE INDEX IF NOT EXISTS ix_msgs_created ON chat_messages(session_id, created_at);

-- snapshots table for sharing
CREATE TABLE IF NOT EXISTS chat_snapshots (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS ix_snapshots_session ON chat_snapshots(session_id, created_at);

