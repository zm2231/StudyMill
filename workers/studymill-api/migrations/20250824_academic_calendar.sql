-- Academic calendar support (2025-08-24)
-- Stores official academic dates (holidays, breaks, key deadlines) by term

CREATE TABLE IF NOT EXISTS academic_calendar_dates (
  id TEXT PRIMARY KEY,
  term_code TEXT NOT NULL,        -- e.g., 202508 for Fall 2025
  date TEXT NOT NULL,             -- YYYY-MM-DD
  name TEXT NOT NULL,             -- e.g., Labor Day, Thanksgiving Break
  category TEXT,                  -- holiday|break|deadline|event
  campus TEXT,                    -- optional (Athens, Griffin, etc.)
  notes TEXT,                     -- optional free-form
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_academic_calendar_term ON academic_calendar_dates(term_code);
CREATE INDEX IF NOT EXISTS idx_academic_calendar_date ON academic_calendar_dates(date);
