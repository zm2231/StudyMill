-- Enhanced Course Management Schema Migration
-- Adds full scheduling, semester, and course management functionality

-- Add missing columns to courses table
ALTER TABLE courses ADD COLUMN code TEXT;
ALTER TABLE courses ADD COLUMN color TEXT DEFAULT '#3b82f6';
ALTER TABLE courses ADD COLUMN instructor TEXT;
ALTER TABLE courses ADD COLUMN credits INTEGER DEFAULT 3;
ALTER TABLE courses ADD COLUMN semester_id TEXT;

-- Create semesters table
CREATE TABLE IF NOT EXISTS semesters (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_semesters_user_id ON semesters(user_id);
CREATE INDEX IF NOT EXISTS idx_semesters_current ON semesters(is_current);

-- Create course_schedule table for class time slots
CREATE TABLE IF NOT EXISTS course_schedule (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  day_of_week INTEGER NOT NULL, -- 0 = Sunday, 1 = Monday, etc.
  start_time TEXT NOT NULL, -- "HH:MM" format
  end_time TEXT NOT NULL, -- "HH:MM" format
  location TEXT,
  timezone TEXT DEFAULT 'America/New_York',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_course_schedule_course_id ON course_schedule(course_id);
CREATE INDEX IF NOT EXISTS idx_course_schedule_day ON course_schedule(day_of_week);

-- Create lecture_sessions table for individual class sessions
CREATE TABLE IF NOT EXISTS lecture_sessions (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  date DATE NOT NULL,
  title TEXT,
  week_number INTEGER,
  has_audio INTEGER DEFAULT 0,
  has_notes INTEGER DEFAULT 0,
  audio_file_id TEXT,
  document_ids TEXT, -- JSON array of document IDs
  memory_ids TEXT, -- JSON array of memory IDs
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(course_id, date) -- One session per course per day
);

CREATE INDEX IF NOT EXISTS idx_lecture_sessions_course_id ON lecture_sessions(course_id);
CREATE INDEX IF NOT EXISTS idx_lecture_sessions_user_id ON lecture_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_lecture_sessions_date ON lecture_sessions(date);

-- Add foreign key constraint for semester_id in courses table
-- Note: SQLite doesn't support adding foreign keys to existing tables directly
-- This would need to be handled in the application layer

-- Update courses table constraint (if we were recreating the table)
-- FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE SET NULL

-- Add trigger to update updated_at timestamps
CREATE TRIGGER IF NOT EXISTS update_semesters_updated_at 
  AFTER UPDATE ON semesters
  BEGIN
    UPDATE semesters SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS update_lecture_sessions_updated_at 
  AFTER UPDATE ON lecture_sessions
  BEGIN
    UPDATE lecture_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

-- Insert a default current semester for existing users (optional)
-- This will help with testing and initial setup
INSERT OR IGNORE INTO semesters (id, user_id, name, start_date, end_date, is_current)
SELECT 
  'sem_' || substr(hex(randomblob(16)), 1, 24) as id,
  id as user_id,
  'Fall 2025' as name,
  '2025-08-15' as start_date,
  '2025-12-15' as end_date,
  1 as is_current
FROM users;