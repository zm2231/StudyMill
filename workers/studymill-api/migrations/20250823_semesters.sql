-- Create semesters table
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

-- Note: Columns may already exist from previous migrations, skipping ALTER TABLE commands
-- semester_id, archived, code, color, instructor, credits, schedule columns should be added manually if needed

-- Add indexes for columns (if they exist)
CREATE INDEX IF NOT EXISTS idx_courses_semester_id ON courses(semester_id);
CREATE INDEX IF NOT EXISTS idx_courses_archived ON courses(archived);
