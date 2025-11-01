-- Add new status to task_status enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'awaiting_admin_review' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'task_status')
    ) THEN
        ALTER TYPE task_status ADD VALUE 'awaiting_admin_review';
    END IF;
END $$;

-- Add is_required field to tasks table
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_required BOOLEAN DEFAULT false;

-- Add admin_review_status field to track admin review
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'admin_review_status') THEN
        CREATE TYPE admin_review_status AS ENUM ('pending', 'approved', 'rejected');
    END IF;
END $$;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS admin_review_status admin_review_status;

-- Add admin_rejection_reason field
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS admin_rejection_reason TEXT;

-- Add index for faster queries on admin review status
CREATE INDEX IF NOT EXISTS idx_tasks_admin_review_status ON tasks(admin_review_status) WHERE admin_review_status IS NOT NULL;

-- Add index for required tasks
CREATE INDEX IF NOT EXISTS idx_tasks_is_required ON tasks(is_required) WHERE is_required = true;

