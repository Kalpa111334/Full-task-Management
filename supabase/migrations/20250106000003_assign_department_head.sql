-- Assign department head to a department
-- First, ensure we have at least one department
INSERT INTO public.departments (id, name, description) 
VALUES ('00000000-0000-0000-0000-000000000001', 'Purchasing Department', 'Department responsible for purchasing activities')
ON CONFLICT (id) DO NOTHING;

-- Update the department head user to be assigned to the Purchasing Department
-- This assumes the department head user has email 'd_head@example.com' or similar
UPDATE public.employees 
SET department_id = '00000000-0000-0000-0000-000000000001'
WHERE role = 'department_head' 
  AND (email LIKE '%d_head%' OR name LIKE '%D_Head%' OR name LIKE '%Department Head%')
  AND department_id IS NULL;

-- If no department head was found with the above criteria, update any department head without a department
UPDATE public.employees 
SET department_id = '00000000-0000-0000-0000-000000000001'
WHERE role = 'department_head' 
  AND department_id IS NULL;
