-- Add task type and tracking fields
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task_type TEXT DEFAULT 'normal' CHECK (task_type IN ('normal', 'location_based'));
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completion_photo_url TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES employees(id);
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;

-- Add battery level to employees table for tracking
ALTER TABLE employees ADD COLUMN IF NOT EXISTS battery_level INTEGER;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS last_location_update TIMESTAMP WITH TIME ZONE;

-- Create storage bucket for task completion photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('task-photos', 'task-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for task photos
CREATE POLICY "Anyone can view task photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'task-photos');

CREATE POLICY "Employees can upload task photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'task-photos' AND auth.uid()::text = (storage.foldername(name))[1]);