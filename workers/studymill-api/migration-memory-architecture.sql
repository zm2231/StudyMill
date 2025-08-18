-- Migration: Memory Architecture for StudyMill v2.0
-- Adds memory tables and user partitioning support
-- Run this after the main schema to enable memory features

-- Core memories table - central storage for all knowledge pieces
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  source_type TEXT NOT NULL, -- 'document', 'web', 'conversation', 'manual', 'audio'
  source_id TEXT, -- Reference to original source (document_id, url, etc.)
  container_tags TEXT, -- JSON array of tags for organization ["course_cs101", "midterm"]
  metadata TEXT, -- JSON metadata (title, author, date, etc.)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Memory chunks for vector search and retrieval
CREATE TABLE IF NOT EXISTS memory_chunks (
  id TEXT PRIMARY KEY, -- Matches Vectorize vector ID
  memory_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL, -- Actual chunk text content
  embedding_id TEXT, -- Reference to Vectorize vector ID (same as id)
  token_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
);

-- Memory relationships for connecting related memories
CREATE TABLE IF NOT EXISTS memory_relations (
  id TEXT PRIMARY KEY,
  memory_a_id TEXT NOT NULL,
  memory_b_id TEXT NOT NULL,
  relation_type TEXT NOT NULL, -- 'similar', 'contradicts', 'builds_on', 'references'
  strength REAL DEFAULT 0.0, -- 0.0 to 1.0 relationship strength
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (memory_a_id) REFERENCES memories(id) ON DELETE CASCADE,
  FOREIGN KEY (memory_b_id) REFERENCES memories(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories(user_id);
CREATE INDEX IF NOT EXISTS idx_memories_source_type ON memories(source_type);
CREATE INDEX IF NOT EXISTS idx_memories_source_id ON memories(source_id);
CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at);

CREATE INDEX IF NOT EXISTS idx_memory_chunks_memory_id ON memory_chunks(memory_id);
CREATE INDEX IF NOT EXISTS idx_memory_chunks_embedding_id ON memory_chunks(embedding_id);

CREATE INDEX IF NOT EXISTS idx_memory_relations_memory_a ON memory_relations(memory_a_id);
CREATE INDEX IF NOT EXISTS idx_memory_relations_memory_b ON memory_relations(memory_b_id);
CREATE INDEX IF NOT EXISTS idx_memory_relations_type ON memory_relations(relation_type);

-- Full-text search for memories
CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
  id UNINDEXED,
  content,
  container_tags,
  content='memories',
  content_rowid='rowid'
);

-- Triggers to keep FTS index in sync
CREATE TRIGGER IF NOT EXISTS memories_fts_insert AFTER INSERT ON memories BEGIN
  INSERT INTO memories_fts(rowid, id, content, container_tags) 
  VALUES (new.rowid, new.id, new.content, new.container_tags);
END;

CREATE TRIGGER IF NOT EXISTS memories_fts_delete AFTER DELETE ON memories BEGIN
  INSERT INTO memories_fts(memories_fts, rowid, id, content, container_tags) 
  VALUES('delete', old.rowid, old.id, old.content, old.container_tags);
END;

CREATE TRIGGER IF NOT EXISTS memories_fts_update AFTER UPDATE ON memories BEGIN
  INSERT INTO memories_fts(memories_fts, rowid, id, content, container_tags) 
  VALUES('delete', old.rowid, old.id, old.content, old.container_tags);
  INSERT INTO memories_fts(rowid, id, content, container_tags) 
  VALUES (new.rowid, new.id, new.content, new.container_tags);
END;

-- Update triggers for timestamps
CREATE TRIGGER IF NOT EXISTS update_memories_updated_at 
  AFTER UPDATE ON memories
  BEGIN
    UPDATE memories SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

-- Add memory_id reference to existing documents table for linking
ALTER TABLE documents ADD COLUMN memory_id TEXT REFERENCES memories(id);
CREATE INDEX IF NOT EXISTS idx_documents_memory_id ON documents(memory_id);

-- Update document_chunks to support user partitioning (critical for v2.0)
-- Note: user_id should already exist, but ensure it's indexed for partitioning
CREATE INDEX IF NOT EXISTS idx_document_chunks_user_id_vector ON document_chunks(user_id, vector_id);