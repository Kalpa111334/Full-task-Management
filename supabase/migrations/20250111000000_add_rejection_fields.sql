-- Add rejection_reason and rejection_count fields to tasks table
-- These fields are used to track task rejections by department heads

-- Add rejection_reason field (for tracking rejection reason from department head)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Add rejection_count field (for tracking how many times a task has been rejected)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS rejection_count INTEGER DEFAULT 0;

-- Add index for faster queries on rejection_count
CREATE INDEX IF NOT EXISTS idx_tasks_rejection_count ON tasks(rejection_count) WHERE rejection_count > 0;
