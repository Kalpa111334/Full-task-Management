-- Create checklists table
CREATE TABLE IF NOT EXISTS public.checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  assigned_to_dept_head UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  department_id UUID REFERENCES public.departments(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create checklist_items table
CREATE TABLE IF NOT EXISTS public.checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID REFERENCES public.checklists(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  order_index INTEGER DEFAULT 0,
  is_completed BOOLEAN DEFAULT false,
  completed_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create checklist_assignments table (for employee assignments by department head)
CREATE TABLE IF NOT EXISTS public.checklist_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checklist_id UUID REFERENCES public.checklists(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(checklist_id, employee_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_checklists_created_by ON public.checklists(created_by);
CREATE INDEX IF NOT EXISTS idx_checklists_assigned_to_dept_head ON public.checklists(assigned_to_dept_head);
CREATE INDEX IF NOT EXISTS idx_checklists_department_id ON public.checklists(department_id);
CREATE INDEX IF NOT EXISTS idx_checklists_status ON public.checklists(status);
CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist_id ON public.checklist_items(checklist_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_completed_by ON public.checklist_items(completed_by);
CREATE INDEX IF NOT EXISTS idx_checklist_assignments_checklist_id ON public.checklist_assignments(checklist_id);
CREATE INDEX IF NOT EXISTS idx_checklist_assignments_employee_id ON public.checklist_assignments(employee_id);

-- Enable Row Level Security
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Allow all to read and manage (since we have simple login system)
CREATE POLICY "Allow all to read checklists" ON public.checklists FOR SELECT USING (true);
CREATE POLICY "Allow all to manage checklists" ON public.checklists FOR ALL USING (true);

CREATE POLICY "Allow all to read checklist_items" ON public.checklist_items FOR SELECT USING (true);
CREATE POLICY "Allow all to manage checklist_items" ON public.checklist_items FOR ALL USING (true);

CREATE POLICY "Allow all to read checklist_assignments" ON public.checklist_assignments FOR SELECT USING (true);
CREATE POLICY "Allow all to manage checklist_assignments" ON public.checklist_assignments FOR ALL USING (true);

