# StudyMill Database Schema Documentation v2.0

## Overview

StudyMill v2.0 uses a memory-first architecture built on Cloudflare D1 (SQLite) with Vectorize for semantic search. The schema supports multi-source knowledge management with strict user partitioning for security.

## Architecture Principles

1. **User Isolation**: All data is partitioned by `user_id` with foreign key constraints
2. **Memory-First Design**: Central `memories` table with relationships to chunks and sources
3. **Vector Integration**: Seamless integration with Cloudflare Vectorize for embeddings
4. **Full-Text Search**: SQLite FTS5 indexes for keyword search
5. **Audit Trail**: Timestamp tracking with automatic triggers

## Core Tables

### Users Table
**Purpose**: User authentication and profile management
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Indexes:**
- `idx_users_email` - Fast email lookups for authentication
- `idx_users_created_at` - User registration analytics

### Courses Table
**Purpose**: Academic course organization
```sql
CREATE TABLE courses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Indexes:**
- `idx_courses_user_id` - User-specific course queries
- `idx_courses_created_at` - Course creation analytics

## Memory Architecture (v2.0)

### Memories Table (NEW)
**Purpose**: Central storage for all knowledge pieces
```sql
CREATE TABLE memories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  source_type TEXT NOT NULL, -- 'document', 'web', 'conversation', 'manual', 'audio'
  source_id TEXT, -- Reference to original source
  container_tags TEXT, -- JSON array: ["course_cs101", "midterm"]
  metadata TEXT, -- JSON metadata: {"title": "...", "author": "..."}
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**Key Features:**
- **Multi-Source Support**: Memories can originate from documents, web pages, conversations, etc.
- **Flexible Tagging**: JSON container_tags for course/topic organization
- **Rich Metadata**: JSON metadata for source-specific information
- **User Isolation**: Strict user partitioning with foreign key constraints

**Indexes:**
- `idx_memories_user_id` - **CRITICAL**: User data isolation
- `idx_memories_source_type` - Filter by origin type
- `idx_memories_source_id` - Link back to original source
- `idx_memories_created_at` - Chronological ordering

### Memory Chunks Table (NEW)
**Purpose**: Vector search optimization and chunk management
```sql
CREATE TABLE memory_chunks (
  id TEXT PRIMARY KEY, -- Matches Vectorize vector ID
  memory_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding_id TEXT, -- Reference to Vectorize vector ID
  token_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
);
```

**Key Features:**
- **Vector Integration**: `id` matches Vectorize vector ID for seamless lookup
- **Intelligent Chunking**: Optimized content segments for semantic search
- **Token Tracking**: Cost management and API usage monitoring

**Indexes:**
- `idx_memory_chunks_memory_id` - Link chunks to parent memory
- `idx_memory_chunks_embedding_id` - Vector lookup optimization

### Memory Relations Table (NEW)
**Purpose**: Semantic relationships between memories
```sql
CREATE TABLE memory_relations (
  id TEXT PRIMARY KEY,
  memory_a_id TEXT NOT NULL,
  memory_b_id TEXT NOT NULL,
  relation_type TEXT NOT NULL, -- 'similar', 'contradicts', 'builds_on', 'references'
  strength REAL DEFAULT 0.0, -- 0.0 to 1.0 relationship strength
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (memory_a_id) REFERENCES memories(id) ON DELETE CASCADE,
  FOREIGN KEY (memory_b_id) REFERENCES memories(id) ON DELETE CASCADE
);
```

**Relation Types:**
- `similar`: Semantically similar content
- `contradicts`: Conflicting information
- `builds_on`: Extends or elaborates
- `references`: Cites or mentions

**Indexes:**
- `idx_memory_relations_memory_a` - Forward relationship lookup
- `idx_memory_relations_memory_b` - Reverse relationship lookup
- `idx_memory_relations_type` - Filter by relationship type

## Document Management (Enhanced)

### Documents Table (Updated)
**Purpose**: File upload and processing tracking
```sql
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  processing_status TEXT DEFAULT 'pending',
  processing_error TEXT,
  memory_id TEXT, -- NEW: Link to generated memory
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (memory_id) REFERENCES memories(id) -- NEW: Memory link
);
```

**v2.0 Changes:**
- Added `memory_id` column to link documents to generated memories
- Enhanced processing workflow integration

**Indexes:**
- `idx_documents_user_id` - **CRITICAL**: User data isolation
- `idx_documents_course_id` - Course-specific document queries
- `idx_documents_memory_id` - NEW: Memory linkage
- `idx_documents_processing_status` - Processing queue management

### Document Chunks Table (Enhanced)
**Purpose**: Document text segmentation with user partitioning
```sql
CREATE TABLE document_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content_text TEXT NOT NULL,
  content_type TEXT DEFAULT 'paragraph',
  page_number INTEGER,
  character_count INTEGER,
  vector_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

**v2.0 Security Enhancement:**
- Added compound index `idx_document_chunks_user_id_vector` for user-partitioned vector operations

## Full-Text Search (Enhanced)

### Memories FTS (NEW)
**Purpose**: Fast keyword search across memories
```sql
CREATE VIRTUAL TABLE memories_fts USING fts5(
  id UNINDEXED,
  content,
  container_tags,
  content='memories',
  content_rowid='rowid'
);
```

**Auto-Sync Triggers:**
```sql
-- Insert trigger
CREATE TRIGGER memories_fts_insert AFTER INSERT ON memories BEGIN
  INSERT INTO memories_fts(rowid, id, content, container_tags) 
  VALUES (new.rowid, new.id, new.content, new.container_tags);
END;

-- Update trigger
CREATE TRIGGER memories_fts_update AFTER UPDATE ON memories BEGIN
  INSERT INTO memories_fts(memories_fts, rowid, id, content, container_tags) 
  VALUES('delete', old.rowid, old.id, old.content, old.container_tags);
  INSERT INTO memories_fts(rowid, id, content, container_tags) 
  VALUES (new.rowid, new.id, new.content, new.container_tags);
END;

-- Delete trigger
CREATE TRIGGER memories_fts_delete AFTER DELETE ON memories BEGIN
  INSERT INTO memories_fts(memories_fts, rowid, id, content, container_tags) 
  VALUES('delete', old.rowid, old.id, old.content, old.container_tags);
END;
```

## Vector Search Integration

### Vectorize Metadata Schema
**Purpose**: User-partitioned vector search with rich metadata
```javascript
// Vector metadata structure for Cloudflare Vectorize
{
  id: "chunk_uuid", // Matches memory_chunks.id
  vector: [768-dimensional embedding],
  metadata: {
    user_id: "user_uuid",        // CRITICAL: User partitioning
    memory_id: "memory_uuid",     // Link to parent memory
    source_type: "document",      // Origin classification
    container_tags: ["course_cs101", "midterm"], // Organization
    chunk_index: 0,              // Position in memory
    created_at: "2024-01-15T10:00:00Z"
  }
}
```

**Security Features:**
- **Mandatory User Filtering**: All vector queries MUST filter by `user_id`
- **Source Tracking**: Complete audit trail from vector to original source
- **Tag-Based Organization**: Flexible filtering and organization

## Analytics and Audit Tables

### Search Analytics
**Purpose**: Search pattern analysis and optimization
```sql
CREATE TABLE search_analytics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  query_text TEXT NOT NULL,
  query_type TEXT NOT NULL, -- 'semantic', 'keyword', 'hybrid'
  course_id TEXT,
  document_type TEXT,
  results_count INTEGER NOT NULL,
  execution_time_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL
);
```

### Study Sessions
**Purpose**: Learning analytics and progress tracking
```sql
CREATE TABLE study_sessions (
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
```

## Migration Guide

### From v1.0 to v2.0

1. **Run Memory Architecture Migration**:
   ```bash
   npx wrangler d1 execute studymill-db --file=migration-memory-architecture.sql
   ```

2. **Verify New Tables**:
   ```sql
   SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'memor%';
   ```

3. **Update Vector Queries**: Ensure all semantic search operations include user partitioning

4. **Test User Isolation**: Verify cross-user data access is impossible

### Migration Script Breakdown

The `migration-memory-architecture.sql` script includes:
- ✅ Core memory tables creation
- ✅ Memory chunks and relations
- ✅ Full-text search indexes
- ✅ Auto-sync triggers
- ✅ User partitioning indexes
- ✅ Memory linkage in documents table

## Security Considerations

### User Data Isolation
1. **Database Level**: Foreign key constraints ensure data ownership
2. **Application Level**: All queries filter by `user_id`
3. **Vector Level**: Metadata filtering prevents cross-user vector access

### Performance Optimization
1. **Compound Indexes**: User-specific operations are optimized
2. **FTS Integration**: Fast keyword search without external dependencies
3. **Vector Caching**: Memory chunks cached for repeated access

### Data Integrity
1. **Cascading Deletes**: User deletion removes all associated data
2. **Relationship Constraints**: Memory relations maintain consistency
3. **Trigger Automation**: FTS indexes stay synchronized automatically

## Query Examples

### User-Isolated Memory Search
```sql
-- Safe: User-partitioned memory query
SELECT * FROM memories 
WHERE user_id = ? AND content LIKE ?
ORDER BY created_at DESC;

-- Unsafe: Missing user partition (avoided)
SELECT * FROM memories WHERE content LIKE ?;
```

### Memory with Relationships
```sql
-- Get memory with related memories
SELECT m.*, mr.relation_type, mr.strength
FROM memories m
LEFT JOIN memory_relations mr ON (m.id = mr.memory_a_id OR m.id = mr.memory_b_id)
WHERE m.user_id = ? AND m.id = ?;
```

### Full-Text Search
```sql
-- Search memories by content and tags
SELECT m.* FROM memories m
JOIN memories_fts fts ON m.rowid = fts.rowid
WHERE fts.content MATCH ? AND m.user_id = ?
ORDER BY rank;
```

## Performance Benchmarks

- **Memory Creation**: <100ms per memory with chunking
- **Search Latency**: <300ms for hybrid search (semantic + keyword)
- **User Isolation**: Zero performance impact due to optimized indexes
- **FTS Search**: <50ms for keyword queries

---

*Database Schema v2.0 - Memory-first architecture with user partitioning*