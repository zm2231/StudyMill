-- Course weeks tracking table
-- Maps semester weeks to date ranges for planner organization

CREATE TABLE IF NOT EXISTS course_weeks (
  id TEXT PRIMARY KEY,
  semester_id TEXT NOT NULL,
  week_number INTEGER NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_course_weeks_semester_id ON course_weeks(semester_id);
CREATE INDEX IF NOT EXISTS idx_course_weeks_week_number ON course_weeks(week_number);
CREATE INDEX IF NOT EXISTS idx_course_weeks_start_date ON course_weeks(start_date);
CREATE INDEX IF NOT EXISTS idx_course_weeks_end_date ON course_weeks(end_date);

-- Unique constraint to prevent duplicate weeks per semester
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_semester_week ON course_weeks(semester_id, week_number);

-- Trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_course_weeks_updated_at 
  AFTER UPDATE ON course_weeks
  BEGIN
    UPDATE course_weeks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;