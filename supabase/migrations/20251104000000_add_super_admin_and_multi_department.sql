-- Add super_admin role to the employee_role enum
ALTER TYPE employee_role ADD VALUE IF NOT EXISTS 'super_admin';

-- Create admin_departments junction table for multi-department admin access
CREATE TABLE IF NOT EXISTS public.admin_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(admin_id, department_id)
);

-- Enable Row Level Security
ALTER TABLE public.admin_departments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for admin_departments
CREATE POLICY "Allow all to read admin_departments" ON public.admin_departments FOR SELECT USING (true);
CREATE POLICY "Allow all to manage admin_departments" ON public.admin_departments FOR ALL USING (true);

-- Enable realtime for admin_departments
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_departments;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_departments_admin_id ON public.admin_departments(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_departments_department_id ON public.admin_departments(department_id);

-- Comment on table
COMMENT ON TABLE public.admin_departments IS 'Junction table mapping admin users to multiple departments they can manage';
COMMENT ON COLUMN public.admin_departments.admin_id IS 'Reference to employee with admin role';
COMMENT ON COLUMN public.admin_departments.department_id IS 'Reference to department the admin can manage';
