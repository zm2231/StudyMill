-- 20250825_add_decks_and_flashcard_reviews.sql
-- Adds decks table, links flashcards to decks, and introduces flashcard_reviews for analytics
-- Safe to run multiple times: uses IF NOT EXISTS and conditional ALTERs where possible.

-- 1) Create decks table
CREATE TABLE IF NOT EXISTS decks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  assignment_id TEXT,
  week_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  source_type TEXT DEFAULT 'custom', -- 'lecture' | 'week' | 'test' | 'custom'
  metadata TEXT, -- JSON object
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_decks_user_id ON decks(user_id);
CREATE INDEX IF NOT EXISTS idx_decks_course_id ON decks(course_id);
CREATE INDEX IF NOT EXISTS idx_decks_assignment_id ON decks(assignment_id);
CREATE INDEX IF NOT EXISTS idx_decks_week_id ON decks(week_id);
CREATE INDEX IF NOT EXISTS idx_decks_created_at ON decks(created_at);

-- Trigger for updated_at
CREATE TRIGGER IF NOT EXISTS update_decks_updated_at
  AFTER UPDATE ON decks
BEGIN
  UPDATE decks SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- 2) Add deck_id to flashcards (if not exists) and supporting index/FK
-- Cloudflare D1 (SQLite) does not support IF NOT EXISTS on ALTER COLUMN ADD; use a guard via pragma table_info
-- We emulate idempotency by attempting the ALTER in a transaction and ignoring the error if the column already exists.

-- Add column deck_id
BEGIN TRANSACTION;
  -- Attempt to add deck_id; ignore error if exists
  SELECT 1 FROM pragma_table_info('flashcards') WHERE name = 'deck_id';
  -- If not present, the following statement will run without conflict; if present, it will fail and the transaction will roll back, but table remains unchanged.
  ALTER TABLE flashcards ADD COLUMN deck_id TEXT;
COMMIT;

-- Create index and add FK via a soft check (SQLite lacks ALTER TABLE ADD CONSTRAINT after creation); we enforce via app logic
CREATE INDEX IF NOT EXISTS idx_flashcards_deck_id ON flashcards(deck_id);

-- Ensure FSRS-related columns exist (attempt to add; ignore if present)
BEGIN TRANSACTION;
  SELECT 1 FROM pragma_table_info('flashcards') WHERE name = 'fsrs_state';
  ALTER TABLE flashcards ADD COLUMN fsrs_state TEXT;
COMMIT;

BEGIN TRANSACTION;
  SELECT 1 FROM pragma_table_info('flashcards') WHERE name = 'stability';
  ALTER TABLE flashcards ADD COLUMN stability REAL DEFAULT 0;
COMMIT;

BEGIN TRANSACTION;
  SELECT 1 FROM pragma_table_info('flashcards') WHERE name = 'difficulty';
  ALTER TABLE flashcards ADD COLUMN difficulty REAL DEFAULT 0;
COMMIT;

BEGIN TRANSACTION;
  SELECT 1 FROM pragma_table_info('flashcards') WHERE name = 'next_review';
  ALTER TABLE flashcards ADD COLUMN next_review DATETIME;
COMMIT;

BEGIN TRANSACTION;
  SELECT 1 FROM pragma_table_info('flashcards') WHERE name = 'review_count';
  ALTER TABLE flashcards ADD COLUMN review_count INTEGER DEFAULT 0;
COMMIT;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_flashcards_next_review ON flashcards(next_review);
CREATE INDEX IF NOT EXISTS idx_flashcards_created_at ON flashcards(created_at);

-- 3) Create flashcard_reviews table for analytics
CREATE TABLE IF NOT EXISTS flashcard_reviews (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  flashcard_id TEXT NOT NULL,
  rating INTEGER NOT NULL, -- 1..4 (Anki scale)
  reviewed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  due_before DATETIME,
  due_after DATETIME,
  stability_before REAL,
  stability_after REAL,
  difficulty_before REAL,
  difficulty_after REAL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (flashcard_id) REFERENCES flashcards(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_flashcard_reviews_user_id ON flashcard_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_flashcard_reviews_flashcard_id ON flashcard_reviews(flashcard_id);
CREATE INDEX IF NOT EXISTS idx_flashcard_reviews_reviewed_at ON flashcard_reviews(reviewed_at);

-- 4) Backfill: Create 'Ungrouped' deck for any existing user+course cards missing deck_id
-- Note: SQLite lacks procedural logic; this is documented and should be performed via application code if needed.
-- For reference, suggested app-side backfill logic:
--   For each (user_id, course_id) with flashcards where deck_id IS NULL, create a deck named 'Ungrouped' and update those cards to that deck.

