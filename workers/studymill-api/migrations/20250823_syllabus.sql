-- Create grade_weights table for storing syllabus grading breakdown
CREATE TABLE IF NOT EXISTS grade_weights (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL, -- "Homework", "Exams", "Participation", etc.
  weight_pct REAL NOT NULL, -- 0.20 for 20%
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Update assignments table to support syllabus parsing
ALTER TABLE assignments ADD COLUMN week_no INTEGER; -- Week number in semester
ALTER TABLE assignments ADD COLUMN points REAL; -- Point value
ALTER TABLE assignments ADD COLUMN weight_category TEXT; -- Links to grade_weights.name
ALTER TABLE assignments ADD COLUMN source TEXT DEFAULT 'manual'; -- 'manual', 'syllabus', 'schedule'

-- Create syllabus_documents table to track parsed syllabus files
CREATE TABLE IF NOT EXISTS syllabus_documents (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  document_type TEXT NOT NULL, -- 'syllabus' or 'schedule'
  parsed_data TEXT, -- JSON of extracted data
  parsing_status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'error'
  parsing_error TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_grade_weights_course_id ON grade_weights(course_id);
CREATE INDEX IF NOT EXISTS idx_grade_weights_user_id ON grade_weights(user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_week_no ON assignments(week_no);
CREATE INDEX IF NOT EXISTS idx_assignments_weight_category ON assignments(weight_category);
CREATE INDEX IF NOT EXISTS idx_syllabus_documents_course_id ON syllabus_documents(course_id);
CREATE INDEX IF NOT EXISTS idx_syllabus_documents_status ON syllabus_documents(parsing_status);