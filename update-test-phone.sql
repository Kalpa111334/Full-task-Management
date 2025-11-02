-- Add phone number 0755682782 to employees for testing
-- Run this in Supabase SQL Editor

-- Option 1: Update by email (recommended)
UPDATE employees 
SET phone = '0755682782'
WHERE email = 'your-email@example.com';  -- Replace with your actual email

-- Option 2: Update by ID
-- UPDATE employees 
-- SET phone = '0755682782'
-- WHERE id = 'your-employee-id';  -- Replace with your actual employee ID

-- Option 3: Update all department heads (for testing)
-- UPDATE employees 
-- SET phone = '0755682782'
-- WHERE role = 'department_head';

-- Option 4: Update all employees (for testing)
-- UPDATE employees 
-- SET phone = '0755682782'
-- WHERE role = 'employee';

-- Check current phone numbers
SELECT id, name, email, role, phone, is_active
FROM employees
WHERE is_active = true
ORDER BY role, name;

-- Verify the update
SELECT id, name, email, role, phone
FROM employees
WHERE phone = '0755682782';
