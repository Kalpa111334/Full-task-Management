-- Quick Database Check for WhatsApp Testing
-- Phone: 0755682782

-- 1. Check current phone numbers
SELECT 
    id, 
    name, 
    email, 
    role, 
    phone,
    is_active,
    department_id
FROM employees
WHERE is_active = true
ORDER BY role, name;

-- 2. Check if anyone has the test phone
SELECT * FROM employees WHERE phone LIKE '%755682782%';

-- 3. Add phone to ALL active employees for testing
UPDATE employees 
SET phone = '0755682782'
WHERE is_active = true;

-- 4. Verify update
SELECT 
    id, 
    name, 
    email, 
    role, 
    phone
FROM employees
WHERE phone = '0755682782'
ORDER BY role, name;

-- 5. Count by role
SELECT 
    role,
    COUNT(*) as count,
    COUNT(phone) as with_phone
FROM employees
WHERE is_active = true
GROUP BY role;
