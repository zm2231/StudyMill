-- Migration: Add document processing tables
-- Run this after the main schema to add processing capabilities

-- Document processed content storage
CREATE TABLE IF NOT EXISTS document_content (
  document_id TEXT PRIMARY KEY,
  extracted_text TEXT NOT NULL,
  content_data TEXT, -- JSON data with tables, images, etc.
  processed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_document_content_processed_at ON document_content(processed_at);

-- Add any missing triggers for document_content
CREATE TRIGGER IF NOT EXISTS update_document_content_processed_at 
  AFTER UPDATE ON document_content
  BEGIN
    UPDATE document_content SET processed_at = CURRENT_TIMESTAMP WHERE document_id = NEW.document_id;
  END;