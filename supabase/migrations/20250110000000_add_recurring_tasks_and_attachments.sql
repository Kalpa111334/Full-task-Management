-- Add recurring task schedule fields to tasks table
ALTER TABLE public.tasks 
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS recurrence_type TEXT CHECK (recurrence_type IN ('daily', 'weekly', 'monthly')),
ADD COLUMN IF NOT EXISTS recurrence_day INTEGER, -- For weekly: 0-6 (Sunday-Saturday), For monthly: 1-31 (day of month)
ADD COLUMN IF NOT EXISTS recurrence_end_date TIMESTAMPTZ, -- Optional end date for recurring tasks
ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE, -- Reference to original task if this is a recurring instance
ADD COLUMN IF NOT EXISTS next_recurrence_date TIMESTAMPTZ; -- Next date when task should be created

-- Ensure task_attachments table exists (it should from earlier migration)
-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON public.task_attachments(task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_recurring ON public.tasks(is_recurring, parent_task_id) WHERE is_recurring = true;

-- Create storage bucket for task attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('task-attachments', 'task-attachments', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage policies for task attachments
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Anyone can view task attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload task attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update task attachments" ON storage.objects;

-- Create new policies
CREATE POLICY "Anyone can view task attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'task-attachments');

CREATE POLICY "Anyone can upload task attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'task-attachments');

CREATE POLICY "Anyone can update task attachments"
ON storage.objects FOR UPDATE
USING (bucket_id = 'task-attachments');

-- Add comment for documentation
COMMENT ON COLUMN public.tasks.recurrence_type IS 'Type of recurrence: daily, weekly, or monthly';
COMMENT ON COLUMN public.tasks.recurrence_day IS 'Day for recurrence: For weekly (0-6 Sunday-Saturday), For monthly (1-31 day of month)';
COMMENT ON COLUMN public.tasks.parent_task_id IS 'Reference to the original recurring task template';

