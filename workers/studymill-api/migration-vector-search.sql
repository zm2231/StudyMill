-- Vector Search and Semantic Indexing Migration
-- This migration adds tables and indexes to support vector embeddings and semantic search

-- Table for storing embedding metadata and enabling keyword/filter search
CREATE TABLE IF NOT EXISTS document_embeddings (
  id TEXT PRIMARY KEY,               -- Unique chunk ID (matches Vectorize index)
  document_id TEXT NOT NULL,         -- Reference to parent document
  course_id TEXT NOT NULL,           -- For course-based filtering
  document_type TEXT,                -- Type: lecture_note, textbook_chapter, etc.
  chunk_text TEXT NOT NULL,          -- Original text content
  chunk_index INTEGER NOT NULL,      -- Position within document
  page_number INTEGER,               -- Source page number (if applicable)
  content_hash TEXT NOT NULL,        -- SHA-256 hash for deduplication
  token_count INTEGER DEFAULT 0,     -- For cost tracking
  created_at TEXT NOT NULL,          -- Timestamp for date filtering
  indexed_at TEXT,                   -- When vector was created
  
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- Indexes for efficient filtering and search
CREATE INDEX IF NOT EXISTS idx_embeddings_course_id ON document_embeddings(course_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_document_type ON document_embeddings(document_type);
CREATE INDEX IF NOT EXISTS idx_embeddings_created_at ON document_embeddings(created_at);
CREATE INDEX IF NOT EXISTS idx_embeddings_content_hash ON document_embeddings(content_hash);
CREATE INDEX IF NOT EXISTS idx_embeddings_document_id ON document_embeddings(document_id);

-- Full-text search index for keyword search
CREATE VIRTUAL TABLE IF NOT EXISTS embeddings_fts USING fts5(
  id UNINDEXED,
  chunk_text,
  content='document_embeddings',
  content_rowid='rowid'
);

-- Triggers to keep FTS index in sync
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

-- Table for caching query embeddings (cost optimization)
CREATE TABLE IF NOT EXISTS query_embeddings_cache (
  query_hash TEXT PRIMARY KEY,       -- SHA-256 hash of normalized query
  query_text TEXT NOT NULL,          -- Original query for debugging
  embedding_vector TEXT NOT NULL,    -- JSON array of embedding values
  created_at TEXT NOT NULL,          -- Cache timestamp
  access_count INTEGER DEFAULT 1,    -- Usage tracking
  last_accessed TEXT NOT NULL        -- Last access time
);

-- Index for cache cleanup (remove old entries)
CREATE INDEX IF NOT EXISTS idx_query_cache_last_accessed ON query_embeddings_cache(last_accessed);

-- Table for search analytics and optimization
CREATE TABLE IF NOT EXISTS search_analytics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  query_text TEXT NOT NULL,
  query_type TEXT NOT NULL,          -- 'semantic', 'keyword', 'hybrid'
  course_id TEXT,                    -- Filter applied
  document_type TEXT,                -- Filter applied
  results_count INTEGER NOT NULL,
  execution_time_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_search_analytics_user_id ON search_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_search_analytics_created_at ON search_analytics(created_at);
CREATE INDEX IF NOT EXISTS idx_search_analytics_query_type ON search_analytics(query_type);

-- Table for tracking embedding costs and usage
CREATE TABLE IF NOT EXISTS embedding_usage (
  id TEXT PRIMARY KEY,
  operation_type TEXT NOT NULL,      -- 'index_document', 'search_query'
  token_count INTEGER NOT NULL,
  api_cost_usd REAL,                -- Estimated cost
  document_id TEXT,                  -- If indexing operation
  user_id TEXT,                      -- If search operation
  created_at TEXT NOT NULL,
  
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Index for cost tracking queries
CREATE INDEX IF NOT EXISTS idx_embedding_usage_created_at ON embedding_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_embedding_usage_operation_type ON embedding_usage(operation_type);