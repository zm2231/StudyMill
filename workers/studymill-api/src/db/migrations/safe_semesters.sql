-- Create semesters table (safe migration)
CREATE TABLE IF NOT EXISTS semesters (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL, -- "Spring 2025", "Fall 2024"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_semesters_user_id ON semesters(user_id);
CREATE INDEX IF NOT EXISTS idx_semesters_dates ON semesters(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_semesters_is_current ON semesters(is_current);

-- Add only missing columns to courses (ignore if they exist)
ALTER TABLE courses ADD COLUMN semester_id TEXT REFERENCES semesters(id) ON DELETE SET NULL;
ALTER TABLE courses ADD COLUMN archived BOOLEAN DEFAULT FALSE;
ALTER TABLE courses ADD COLUMN schedule TEXT; -- JSON array of schedule times

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_courses_semester_id ON courses(semester_id);
CREATE INDEX IF NOT EXISTS idx_courses_archived ON courses(archived);