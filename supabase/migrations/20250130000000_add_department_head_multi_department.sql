-- Create department_head_departments junction table for multi-department department head access
CREATE TABLE IF NOT EXISTS public.department_head_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  department_head_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(department_head_id, department_id)
);

-- Enable Row Level Security
ALTER TABLE public.department_head_departments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for department_head_departments
CREATE POLICY "Allow all to read department_head_departments" ON public.department_head_departments FOR SELECT USING (true);
CREATE POLICY "Allow all to manage department_head_departments" ON public.department_head_departments FOR ALL USING (true);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_department_head_departments_department_head_id ON public.department_head_departments(department_head_id);
CREATE INDEX IF NOT EXISTS idx_department_head_departments_department_id ON public.department_head_departments(department_id);

-- Comment on table
COMMENT ON TABLE public.department_head_departments IS 'Junction table mapping department head users to multiple departments they can manage';
COMMENT ON COLUMN public.department_head_departments.department_head_id IS 'Reference to employee with department_head role';
COMMENT ON COLUMN public.department_head_departments.department_id IS 'Reference to department the department head can manage';

-- Migrate existing department_head assignments
-- If a department head has a department_id, create an entry in the junction table
INSERT INTO public.department_head_departments (department_head_id, department_id)
SELECT id, department_id
FROM public.employees
WHERE role = 'department_head' 
  AND department_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.department_head_departments 
    WHERE department_head_departments.department_head_id = employees.id 
    AND department_head_departments.department_id = employees.department_id
  );

