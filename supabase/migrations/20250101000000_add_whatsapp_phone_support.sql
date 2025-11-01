-- WhatsApp Integration - Phone Number Setup
-- This migration ensures the phone column exists in the employees table

-- Add phone column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1    
        FROM information_schema.columns 
        WHERE table_name = 'employees' 
        AND column_name = 'phone'
    ) THEN
        ALTER TABLE employees ADD COLUMN phone TEXT;
        COMMENT ON COLUMN employees.phone IS 'Employee phone number for WhatsApp notifications (format: 94XXXXXXXXX)';
    END IF;
END $$;

-- Create index for phone lookups (optional but recommended)
CREATE INDEX IF NOT EXISTS idx_employees_phone ON employees(phone) WHERE phone IS NOT NULL;

-- Example: Update phone numbers for testing
-- UPDATE employees SET phone = '0771234567' WHERE email = 'test@example.com';
