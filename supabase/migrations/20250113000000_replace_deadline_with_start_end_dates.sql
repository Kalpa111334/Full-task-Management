-- Replace deadline field with start_date and end_date fields
-- This migration adds start_date and end_date columns and removes the deadline column

-- Add new columns
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS end_date TIMESTAMPTZ;

-- For existing tasks, migrate deadline to end_date if it exists
UPDATE tasks 
SET end_date = deadline 
WHERE deadline IS NOT NULL AND end_date IS NULL;

-- Drop the old deadline column
ALTER TABLE tasks DROP COLUMN IF EXISTS deadline;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_tasks_start_date ON tasks(start_date);
CREATE INDEX IF NOT EXISTS idx_tasks_end_date ON tasks(end_date);

-- Add comment to document the schema
COMMENT ON COLUMN tasks.start_date IS 'The date and time when the task should start';
COMMENT ON COLUMN tasks.end_date IS 'The date and time when the task should end';
COMMENT ON COLUMN tasks.start_time IS 'The time of day when work should begin (HH:MM format)';
COMMENT ON COLUMN tasks.end_time IS 'The time of day when work should end (HH:MM format)';
