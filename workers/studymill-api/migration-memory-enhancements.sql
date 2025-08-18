-- Memory Enhancements Migration - Based on Gemini CLI research
-- Implements soft deletes, hierarchical tags, and relationship improvements

-- Add soft delete support to memories table
ALTER TABLE memories ADD COLUMN deleted_at DATETIME;

-- Create hierarchical tags table
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_id TEXT, -- For hierarchical tags like 'programming/python/django'
  description TEXT,
  color TEXT, -- For UI visualization
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Create memory-tag relationship table (many-to-many)
CREATE TABLE IF NOT EXISTS memory_tags (
  memory_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (memory_id, tag_id),
  FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Enhance memory_relations with additional metadata
ALTER TABLE memory_relations ADD COLUMN confidence_score REAL DEFAULT 0.0;
ALTER TABLE memory_relations ADD COLUMN created_by TEXT DEFAULT 'system'; -- 'user', 'system', 'llm'
ALTER TABLE memory_relations ADD COLUMN metadata TEXT; -- JSON for additional data

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_memories_deleted_at ON memories(deleted_at);
CREATE INDEX IF NOT EXISTS idx_memories_user_id_deleted_at ON memories(user_id, deleted_at);

CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_parent_id ON tags(parent_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_user_id_name ON tags(user_id, name);

CREATE INDEX IF NOT EXISTS idx_memory_tags_memory_id ON memory_tags(memory_id);
CREATE INDEX IF NOT EXISTS idx_memory_tags_tag_id ON memory_tags(tag_id);

CREATE INDEX IF NOT EXISTS idx_memory_relations_confidence ON memory_relations(confidence_score);
CREATE INDEX IF NOT EXISTS idx_memory_relations_created_by ON memory_relations(created_by);

-- Update triggers for tags
CREATE TRIGGER IF NOT EXISTS update_tags_updated_at 
  AFTER UPDATE ON tags
  BEGIN
    UPDATE tags SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

-- Create view for active (non-deleted) memories
CREATE VIEW IF NOT EXISTS active_memories AS
SELECT * FROM memories WHERE deleted_at IS NULL;

-- Create view for memory hierarchy (tag paths)
-- This will help with hierarchical tag navigation
CREATE VIEW IF NOT EXISTS tag_hierarchy AS
WITH RECURSIVE tag_path(id, user_id, name, parent_id, path, level) AS (
  -- Base case: root tags (no parent)
  SELECT id, user_id, name, parent_id, name as path, 0 as level
  FROM tags 
  WHERE parent_id IS NULL
  
  UNION ALL
  
  -- Recursive case: child tags
  SELECT t.id, t.user_id, t.name, t.parent_id, 
         tp.path || '/' || t.name as path, 
         tp.level + 1 as level
  FROM tags t
  JOIN tag_path tp ON t.parent_id = tp.id
)
SELECT * FROM tag_path;