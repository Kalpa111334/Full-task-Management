-- Create table to store employee location history for navigation tracking
CREATE TABLE public.employee_location_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  location_lat DOUBLE PRECISION NOT NULL,
  location_lng DOUBLE PRECISION NOT NULL,
  battery_level INTEGER,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employee_location_history ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Allow all to read location history" 
ON public.employee_location_history 
FOR SELECT 
USING (true);

CREATE POLICY "Allow all to insert location history" 
ON public.employee_location_history 
FOR INSERT 
WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_employee_location_history_employee_id ON public.employee_location_history(employee_id);
CREATE INDEX idx_employee_location_history_timestamp ON public.employee_location_history(timestamp DESC);

-- Enable realtime for location history
ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_location_history;