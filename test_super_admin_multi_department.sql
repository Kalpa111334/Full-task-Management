-- Test Script: Super Admin Multi-Department Feature
-- This script demonstrates creating a super admin with multiple department assignments

-- Step 1: Check current employee roles enum
SELECT unnest(enum_range(NULL::employee_role)) AS role;

-- Step 2: View existing departments
SELECT id, name, description FROM departments ORDER BY name;

-- Step 3: Create a test super admin employee
INSERT INTO employees (name, email, password, role)
VALUES ('Super Admin User', 'superadmin@taskvision.com', 'super123', 'super_admin')
RETURNING id, name, role;

-- Step 4: Assign multiple departments to the super admin
-- Replace <super_admin_id> with the ID from Step 3
-- Replace <department_id_1>, <department_id_2>, etc. with actual department IDs from Step 2
/*
INSERT INTO admin_departments (admin_id, department_id)
VALUES 
  ('<super_admin_id>', '<department_id_1>'),
  ('<super_admin_id>', '<department_id_2>'),
  ('<super_admin_id>', '<department_id_3>');
*/

-- Step 5: Verify the admin department assignments
-- Replace <super_admin_id> with the actual ID
/*
SELECT 
  e.id,
  e.name,
  e.role,
  d.name as department_name
FROM employees e
JOIN admin_departments ad ON e.id = ad.admin_id
JOIN departments d ON ad.department_id = d.id
WHERE e.id = '<super_admin_id>';
*/

-- Step 6: View all admins with their assigned departments
SELECT 
  e.id,
  e.name,
  e.email,
  e.role,
  COUNT(ad.department_id) as department_count,
  STRING_AGG(d.name, ', ') as departments
FROM employees e
LEFT JOIN admin_departments ad ON e.id = ad.admin_id
LEFT JOIN departments d ON ad.department_id = d.id
WHERE e.role IN ('admin', 'super_admin')
GROUP BY e.id, e.name, e.email, e.role
ORDER BY e.name;

-- Step 7: Check specific admin's permissions
-- Replace <admin_email> with actual email
/*
SELECT 
  e.name as admin_name,
  e.email,
  e.role,
  d.id as department_id,
  d.name as department_name
FROM employees e
JOIN admin_departments ad ON e.id = ad.admin_id
JOIN departments d ON ad.department_id = d.id
WHERE e.email = '<admin_email>'
ORDER BY d.name;
*/

-- Step 8: Remove a department assignment
-- Replace <super_admin_id> and <department_id>
/*
DELETE FROM admin_departments
WHERE admin_id = '<super_admin_id>' 
  AND department_id = '<department_id>';
*/

-- Step 9: Remove all department assignments for an admin
-- Replace <admin_id>
/*
DELETE FROM admin_departments WHERE admin_id = '<admin_id>';
*/

-- Step 10: Clean up test data (optional)
/*
DELETE FROM admin_departments WHERE admin_id IN (
  SELECT id FROM employees WHERE email = 'superadmin@taskvision.com'
);
DELETE FROM employees WHERE email = 'superadmin@taskvision.com';
*/
