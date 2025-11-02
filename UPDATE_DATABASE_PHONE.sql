-- ✅ UPDATE DATABASE WITH TEST PHONE NUMBER
-- Phone: 94755681782 (or 0755681782)
-- Run this in Supabase SQL Editor BEFORE testing

-- Step 1: Add phone to ALL active employees for testing
UPDATE employees 
SET phone = '0755681782'
WHERE is_active = true;

-- Step 2: Verify phones were added
SELECT 
    id, 
    name, 
    email, 
    role, 
    phone,
    is_active
FROM employees
WHERE phone = '0755681782';

-- Step 3: Check specific roles
SELECT 
    role,
    COUNT(*) as count,
    STRING_AGG(name, ', ') as employees
FROM employees
WHERE phone = '0755681782'
GROUP BY role;

-- Expected output:
-- role              | count | employees
-- -----------------|-------|----------------
-- admin            | X     | Admin Name
-- department_head  | X     | DH Name(s)
-- employee         | X     | Employee Name(s)

-- ✅ SUCCESS: All active employees now have phone 0755681782
-- ✅ WhatsApp will be sent to: 94755681782 (formatted)
-- ✅ Test by creating a task and checking WhatsApp

-- OPTIONAL: Add phone to specific employee by email
-- UPDATE employees 
-- SET phone = '0755681782'
-- WHERE email = 'your-email@example.com';

-- OPTIONAL: Add phone to specific employee by name
-- UPDATE employees 
-- SET phone = '0755681782'
-- WHERE name ILIKE '%your name%';
