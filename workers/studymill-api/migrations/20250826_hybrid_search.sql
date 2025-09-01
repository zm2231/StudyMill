-- 2025-08-26 Hybrid search enablement and metadata consolidation
-- This migration ensures D1 holds full chunk text and FTS indices, while Vectorize holds only vectors + minimal metadata.
-- Originals remain in R2 via existing DocumentService storage.

-- Ensure document_embeddings table exists with required columns
CREATE TABLE IF NOT EXISTS document_embeddings (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  -- user_id optional depending on prior migrations; enforced via joins to courses
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  document_type TEXT,
  page_number INTEGER,
  token_count INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  indexed_at DATETIME
);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_document_id ON document_embeddings(document_id);
CREATE INDEX IF NOT EXISTS idx_document_embeddings_course_id ON document_embeddings(course_id);

-- Ensure FTS5 virtual table for BM25 keyword search
CREATE VIRTUAL TABLE IF NOT EXISTS embeddings_fts USING fts5(
  id UNINDEXED,
  chunk_text,
  content='document_embeddings',
  content_rowid='rowid'
);

-- Keep FTS in sync
CREATE TRIGGER IF NOT EXISTS embeddings_fts_insert AFTER INSERT ON document_embeddings BEGIN
  INSERT INTO embeddings_fts(rowid, id, chunk_text) VALUES (new.rowid, new.id, new.chunk_text);
END;

CREATE TRIGGER IF NOT EXISTS embeddings_fts_delete AFTER DELETE ON document_embeddings BEGIN
  INSERT INTO embeddings_fts(embeddings_fts, rowid, id, chunk_text) VALUES('delete', old.rowid, old.id, old.chunk_text);
END;

CREATE TRIGGER IF NOT EXISTS embeddings_fts_update AFTER UPDATE ON document_embeddings BEGIN
  INSERT INTO embeddings_fts(embeddings_fts, rowid, id, chunk_text) VALUES('delete', old.rowid, old.id, old.chunk_text);
  INSERT INTO embeddings_fts(rowid, id, chunk_text) VALUES (new.rowid, new.id, new.chunk_text);
END;

-- NOTE ON VECTORIZE METADATA
-- We intentionally do NOT store full content in Vectorize metadata to minimize index size and latency.
-- Vectorize vectors should carry only: document_id, course_id, page_number, chunk_index, character_count, user_id.
-- Full chunk text is stored in D1 (document_embeddings.chunk_text). Original files are stored in R2.

