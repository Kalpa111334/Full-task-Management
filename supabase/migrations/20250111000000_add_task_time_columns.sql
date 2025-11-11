-- Add start_time and end_time columns to tasks table
-- These columns store the allocated working hours for the task (e.g., 09:00 - 17:00)

ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS start_time TEXT,
ADD COLUMN IF NOT EXISTS end_time TEXT;

-- Add comments to describe the columns
COMMENT ON COLUMN tasks.start_time IS 'Task start time in HH:MM format (e.g., 09:00)';
COMMENT ON COLUMN tasks.end_time IS 'Task end time in HH:MM format (e.g., 17:00)';

-- Update existing tasks with default times if needed (optional)
UPDATE tasks 
SET start_time = '09:00', end_time = '17:00' 
WHERE start_time IS NULL AND end_time IS NULL;
