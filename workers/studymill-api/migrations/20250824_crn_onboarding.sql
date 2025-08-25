-- UGA CRN onboarding migration (2025-08-24)
-- 1) Master catalog storage for UGA courses (per-term rows)
-- 2) Course metadata columns to align with catalog
-- 3) Indices for fast CRN lookups

-- Master table for bulk-imported UGA catalog rows
CREATE TABLE IF NOT EXISTS uga_courses_master (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  term_code TEXT NOT NULL,           -- e.g., 202508 (Fall 2025), 202601 (Spring 2026)
  crn TEXT NOT NULL,                 -- 5-digit CRN as text to preserve leading zeros
  subject TEXT NOT NULL,             -- e.g., CSCI
  catalog_number TEXT NOT NULL,      -- e.g., 1301
  section TEXT,                      -- e.g., A, 001, etc.
  course_title TEXT NOT NULL,
  instructor TEXT,                   -- primary instructor display name
  credits REAL,                      -- numeric credits
  days TEXT,                         -- e.g., MWF, TR, MTWR, etc.
  start_time TEXT,                   -- 24h HH:MM (local campus time)
  end_time TEXT,                     -- 24h HH:MM (local campus time)
  location TEXT,                     -- building/room
  campus TEXT,                       -- optional
  notes TEXT,                        -- optional free-form
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_uga_courses_master_term_crn ON uga_courses_master(term_code, crn);
CREATE INDEX IF NOT EXISTS idx_uga_courses_master_subject ON uga_courses_master(subject);

-- Add CRN column if it doesn't exist (shouldn't fail on duplicates)
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we'll add it carefully
ALTER TABLE courses ADD COLUMN crn TEXT;
ALTER TABLE courses ADD COLUMN schedule_json TEXT;

CREATE INDEX IF NOT EXISTS idx_courses_crn ON courses(crn);
CREATE INDEX IF NOT EXISTS idx_courses_semester_id ON courses(semester_id);

-- Ensure course_schedules exists to store meeting recurrence (day_of_week-based)
-- (Table is already referenced by routes; create if missing for safety)
CREATE TABLE IF NOT EXISTS course_schedules (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  day_of_week INTEGER NOT NULL,  -- 0=Sun..6=Sat
  start_time TEXT NOT NULL,      -- HH:MM
  end_time TEXT NOT NULL,        -- HH:MM
  location TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_course_schedules_course_id ON course_schedules(course_id);
CREATE INDEX IF NOT EXISTS idx_course_schedules_dow ON course_schedules(day_of_week);
