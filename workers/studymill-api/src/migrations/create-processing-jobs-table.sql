-- Migration: Create processing_jobs table for async document processing
-- This table tracks document processing jobs that are handled by background services

CREATE TABLE IF NOT EXISTS processing_jobs (
    -- Job identification
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    course_id TEXT,
    
    -- File information
    file_name TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    r2_key TEXT NOT NULL UNIQUE,
    
    -- Processing information
    status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'timeout', 'cancelled')),
    priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
    processing_options TEXT, -- JSON string of processing options
    
    -- Timing information
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    started_at TEXT,
    completed_at TEXT,
    estimated_completion TEXT,
    
    -- Integration
    callback_url TEXT,
    
    -- Results and errors
    result TEXT, -- JSON string of processing result
    error TEXT,
    
    -- Foreign key constraints
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_processing_jobs_user_id ON processing_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_priority ON processing_jobs(priority);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_created_at ON processing_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_processing_jobs_user_course ON processing_jobs(user_id, course_id);

-- Index for background service to efficiently find jobs to process
CREATE INDEX IF NOT EXISTS idx_processing_jobs_queue ON processing_jobs(status, priority, created_at)
WHERE status IN ('queued', 'processing');

-- Index for cleanup tasks (remove old completed jobs)
CREATE INDEX IF NOT EXISTS idx_processing_jobs_cleanup ON processing_jobs(status, completed_at)
WHERE status IN ('completed', 'failed', 'cancelled');