-- Create task verification requests table for admin approval workflow
CREATE TABLE IF NOT EXISTS public.task_verification_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  requested_by UUID REFERENCES public.employees(id) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_reason TEXT,
  approved_by UUID REFERENCES public.employees(id),
  approved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.task_verification_requests ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all to read verification requests"
  ON public.task_verification_requests
  FOR SELECT
  USING (true);

CREATE POLICY "Allow all to insert verification requests"
  ON public.task_verification_requests
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow all to update verification requests"
  ON public.task_verification_requests
  FOR UPDATE
  USING (true);

-- Enable realtime for verification requests
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_verification_requests;