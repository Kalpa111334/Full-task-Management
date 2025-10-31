-- Add is_active field to tasks table
ALTER TABLE public.tasks 
ADD COLUMN is_active boolean NOT NULL DEFAULT true;

-- Add index for faster queries on active tasks
CREATE INDEX idx_tasks_is_active ON public.tasks(is_active);