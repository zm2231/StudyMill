-- StudyMill Database Schema
-- Cloudflare D1 SQLite Database

-- Users table for authentication
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Courses table
CREATE TABLE IF NOT EXISTS courses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_courses_user_id ON courses(user_id);
CREATE INDEX IF NOT EXISTS idx_courses_created_at ON courses(created_at);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  processing_status TEXT DEFAULT 'pending',
  processing_error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_documents_course_id ON documents(course_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_processing_status ON documents(processing_status);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);

-- Assignments table
CREATE TABLE IF NOT EXISTS assignments (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  due_date DATETIME,
  assignment_type TEXT DEFAULT 'homework', -- 'test', 'homework', 'project', 'quiz'
  status TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'overdue'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assignments_course_id ON assignments(course_id);
CREATE INDEX IF NOT EXISTS idx_assignments_user_id ON assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON assignments(due_date);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);

-- Chat sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  course_id TEXT,
  assignment_id TEXT,
  title TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_course_id ON chat_sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON chat_sessions(created_at);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL, -- 'user' or 'assistant'
  content TEXT NOT NULL,
  document_references TEXT, -- JSON array of document IDs
  token_count INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);

-- Flashcards table
CREATE TABLE IF NOT EXISTS flashcards (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  tags TEXT, -- JSON array
  fsrs_state TEXT, -- FSRS algorithm state (JSON)
  next_review DATETIME,
  difficulty REAL DEFAULT 0,
  stability REAL DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_flashcards_course_id ON flashcards(course_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_user_id ON flashcards(user_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_next_review ON flashcards(next_review);

-- Notes table
CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  course_id TEXT,
  assignment_id TEXT,
  title TEXT NOT NULL,
  content TEXT NOT NULL, -- TipTap JSON content
  document_references TEXT, -- JSON array of referenced document IDs
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_course_id ON notes(course_id);
CREATE INDEX IF NOT EXISTS idx_notes_created_at ON notes(created_at);

-- Document chunks for vector search (metadata only, vectors stored in Vectorize)
CREATE TABLE IF NOT EXISTS document_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content_text TEXT NOT NULL,
  content_type TEXT DEFAULT 'paragraph', -- 'paragraph', 'heading', 'list', 'table'
  page_number INTEGER,
  character_count INTEGER,
  vector_id TEXT, -- Reference to Vectorize vector ID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_course_id ON document_chunks(course_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_user_id ON document_chunks(user_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_vector_id ON document_chunks(vector_id);

-- Study sessions for analytics
CREATE TABLE IF NOT EXISTS study_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  course_id TEXT,
  session_type TEXT NOT NULL, -- 'reading', 'flashcards', 'chat', 'notes'
  duration_minutes INTEGER,
  items_reviewed INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_study_sessions_user_id ON study_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_course_id ON study_sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_created_at ON study_sessions(created_at);

-- Insert default data (optional)
-- This can be used for development/testing

-- Triggers for updated_at timestamps
CREATE TRIGGER IF NOT EXISTS update_users_updated_at 
  AFTER UPDATE ON users
  BEGIN
    UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS update_courses_updated_at 
  AFTER UPDATE ON courses
  BEGIN
    UPDATE courses SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS update_documents_updated_at 
  AFTER UPDATE ON documents
  BEGIN
    UPDATE documents SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS update_assignments_updated_at 
  AFTER UPDATE ON assignments
  BEGIN
    UPDATE assignments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS update_chat_sessions_updated_at 
  AFTER UPDATE ON chat_sessions
  BEGIN
    UPDATE chat_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS update_flashcards_updated_at 
  AFTER UPDATE ON flashcards
  BEGIN
    UPDATE flashcards SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS update_notes_updated_at 
  AFTER UPDATE ON notes
  BEGIN
    UPDATE notes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

-- Document embeddings table (for semantic search)
CREATE TABLE IF NOT EXISTS document_embeddings (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  document_type TEXT,
  page_number INTEGER,
  token_count INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_document_embeddings_document_id ON document_embeddings(document_id);
CREATE INDEX IF NOT EXISTS idx_document_embeddings_course_id ON document_embeddings(course_id);
CREATE INDEX IF NOT EXISTS idx_document_embeddings_user_id ON document_embeddings(user_id);

-- FTS table for keyword search
CREATE VIRTUAL TABLE IF NOT EXISTS embeddings_fts USING fts5(
  id UNINDEXED,
  chunk_text,
  content='document_embeddings',
  content_rowid='rowid'
);

-- Search analytics table
CREATE TABLE IF NOT EXISTS search_analytics (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  query_text TEXT NOT NULL,
  query_type TEXT NOT NULL,
  course_id TEXT,
  document_type TEXT,
  results_count INTEGER,
  execution_time_ms INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_search_analytics_user_id ON search_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_search_analytics_created_at ON search_analytics(created_at);
CREATE INDEX IF NOT EXISTS idx_search_analytics_query_type ON search_analytics(query_type);

-- Query embeddings cache for performance
CREATE TABLE IF NOT EXISTS query_embeddings_cache (
  id TEXT PRIMARY KEY,
  query_hash TEXT UNIQUE NOT NULL,
  embedding_vector TEXT NOT NULL, -- JSON array
  last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_query_embeddings_cache_hash ON query_embeddings_cache(query_hash);
CREATE INDEX IF NOT EXISTS idx_query_embeddings_cache_accessed ON query_embeddings_cache(last_accessed);

-- Memory tables for enhanced memory management
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  source_type TEXT NOT NULL, -- 'document', 'web', 'conversation', 'manual', 'audio'
  source_id TEXT,
  container_tags TEXT, -- JSON array
  metadata TEXT, -- JSON object
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME, -- Soft delete support
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_memories_user_id ON memories(user_id);
CREATE INDEX IF NOT EXISTS idx_memories_source_type ON memories(source_type);
CREATE INDEX IF NOT EXISTS idx_memories_created_at ON memories(created_at);
CREATE INDEX IF NOT EXISTS idx_memories_deleted_at ON memories(deleted_at);

-- Memory chunks for enhanced chunking
CREATE TABLE IF NOT EXISTS memory_chunks (
  id TEXT PRIMARY KEY,
  memory_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding_id TEXT,
  token_count INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_memory_chunks_memory_id ON memory_chunks(memory_id);
CREATE INDEX IF NOT EXISTS idx_memory_chunks_embedding_id ON memory_chunks(embedding_id);

-- Memory relations for relationship tracking
CREATE TABLE IF NOT EXISTS memory_relations (
  id TEXT PRIMARY KEY,
  memory_a_id TEXT NOT NULL,
  memory_b_id TEXT NOT NULL,
  relation_type TEXT NOT NULL, -- 'similar', 'contradicts', 'builds_on', 'references'
  strength REAL NOT NULL,
  confidence_score REAL NOT NULL,
  created_by TEXT NOT NULL, -- 'user', 'system', 'llm'
  metadata TEXT, -- JSON object
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (memory_a_id) REFERENCES memories(id) ON DELETE CASCADE,
  FOREIGN KEY (memory_b_id) REFERENCES memories(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_memory_relations_memory_a_id ON memory_relations(memory_a_id);
CREATE INDEX IF NOT EXISTS idx_memory_relations_memory_b_id ON memory_relations(memory_b_id);
CREATE INDEX IF NOT EXISTS idx_memory_relations_type ON memory_relations(relation_type);

-- Hierarchical tags system
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  parent_id TEXT,
  description TEXT,
  color TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES tags(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_parent_id ON tags(parent_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tags_user_name ON tags(user_id, name);

-- Memory tags junction table
CREATE TABLE IF NOT EXISTS memory_tags (
  memory_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (memory_id, tag_id),
  FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Query processing tables
CREATE TABLE IF NOT EXISTS query_rewrite_rules (
  id TEXT PRIMARY KEY,
  pattern TEXT NOT NULL,
  replacement TEXT NOT NULL,
  condition TEXT,
  priority INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  domain TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_query_rewrite_rules_priority ON query_rewrite_rules(priority);
CREATE INDEX IF NOT EXISTS idx_query_rewrite_rules_active ON query_rewrite_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_query_rewrite_rules_domain ON query_rewrite_rules(domain);

-- Query processing cache
CREATE TABLE IF NOT EXISTS query_processing_cache (
  cache_key TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  query_data TEXT NOT NULL, -- JSON object
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_query_processing_cache_user_id ON query_processing_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_query_processing_cache_created_at ON query_processing_cache(created_at);

-- Query processing analytics
CREATE TABLE IF NOT EXISTS query_processing_analytics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  original_query TEXT NOT NULL,
  intent_type TEXT NOT NULL,
  entity_count INTEGER,
  alternative_count INTEGER,
  expansion_count INTEGER,
  processing_time_ms INTEGER,
  confidence_score REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_query_processing_analytics_user_id ON query_processing_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_query_processing_analytics_created_at ON query_processing_analytics(created_at);
CREATE INDEX IF NOT EXISTS idx_query_processing_analytics_intent_type ON query_processing_analytics(intent_type);

-- Context synthesis analytics
CREATE TABLE IF NOT EXISTS synthesis_analytics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  query_text TEXT NOT NULL,
  synthesis_type TEXT NOT NULL,
  sources_used INTEGER,
  confidence_score REAL,
  processing_time_ms INTEGER,
  response_style TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_synthesis_analytics_user_id ON synthesis_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_synthesis_analytics_created_at ON synthesis_analytics(created_at);
CREATE INDEX IF NOT EXISTS idx_synthesis_analytics_synthesis_type ON synthesis_analytics(synthesis_type);

-- Audio processing tables for transcription and memory import
CREATE TABLE IF NOT EXISTS audio_files (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  course_id TEXT,
  filename TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  duration_seconds REAL,
  r2_key TEXT NOT NULL,
  processing_status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'error'
  processing_error TEXT,
  transcription_backend TEXT, -- 'openai', 'google', 'local'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_audio_files_user_id ON audio_files(user_id);
CREATE INDEX IF NOT EXISTS idx_audio_files_course_id ON audio_files(course_id);
CREATE INDEX IF NOT EXISTS idx_audio_files_processing_status ON audio_files(processing_status);

-- Audio transcriptions
CREATE TABLE IF NOT EXISTS audio_transcriptions (
  id TEXT PRIMARY KEY,
  audio_file_id TEXT NOT NULL,
  full_text TEXT NOT NULL,
  language TEXT,
  confidence REAL,
  processing_time_ms INTEGER,
  word_timestamps TEXT, -- JSON array
  segment_timestamps TEXT, -- JSON array
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (audio_file_id) REFERENCES audio_files(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audio_transcriptions_audio_file_id ON audio_transcriptions(audio_file_id);

-- Topic segments from audio processing
CREATE TABLE IF NOT EXISTS audio_topic_segments (
  id TEXT PRIMARY KEY,
  audio_file_id TEXT NOT NULL,
  transcription_id TEXT NOT NULL,
  topic TEXT NOT NULL,
  summary TEXT,
  key_points TEXT, -- JSON array
  start_time REAL NOT NULL,
  end_time REAL NOT NULL,
  confidence REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (audio_file_id) REFERENCES audio_files(id) ON DELETE CASCADE,
  FOREIGN KEY (transcription_id) REFERENCES audio_transcriptions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audio_topic_segments_audio_file_id ON audio_topic_segments(audio_file_id);
CREATE INDEX IF NOT EXISTS idx_audio_topic_segments_transcription_id ON audio_topic_segments(transcription_id);

-- Triggers for new tables
CREATE TRIGGER IF NOT EXISTS update_memories_updated_at 
  AFTER UPDATE ON memories
  BEGIN
    UPDATE memories SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS update_audio_files_updated_at 
  AFTER UPDATE ON audio_files
  BEGIN
    UPDATE audio_files SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;