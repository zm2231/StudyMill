-- Migration: Upload API Standardization & Today's Classes
-- Add idempotency_key column for duplicate upload detection

ALTER TABLE documents ADD COLUMN idempotency_key TEXT;
CREATE INDEX IF NOT EXISTS idx_documents_idempotency_key ON documents(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_documents_user_idempotency ON documents(user_id, idempotency_key);

-- Add document_type column if it doesn't exist
ALTER TABLE documents ADD COLUMN document_type TEXT DEFAULT 'unknown';

-- Add schedule support to courses table
ALTER TABLE courses ADD COLUMN schedule_json TEXT;
ALTER TABLE courses ADD COLUMN location TEXT;
ALTER TABLE courses ADD COLUMN color TEXT DEFAULT '#3B82F6';

-- Alternative: Separate course_schedules table for more complex scheduling
CREATE TABLE IF NOT EXISTS course_schedules (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL,
    day_of_week INTEGER NOT NULL, -- 0=Sunday, 1=Monday, etc.
    start_time TEXT NOT NULL,     -- "HH:MM" format 
    end_time TEXT NOT NULL,       -- "HH:MM" format
    location TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_course_schedules_course_id ON course_schedules(course_id);
CREATE INDEX IF NOT EXISTS idx_course_schedules_day_of_week ON course_schedules(day_of_week);

-- Notes table for TipTap editor content
CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    course_id TEXT,
    document_id TEXT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    content_preview TEXT,
    tags TEXT, -- JSON array of tags
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
    FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_course_id ON notes(course_id);
CREATE INDEX IF NOT EXISTS idx_notes_document_id ON notes(document_id);
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at);