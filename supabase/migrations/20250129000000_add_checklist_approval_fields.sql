-- Add approval fields to checklist_items table if they don't exist
DO $$ 
BEGIN
  -- Add approval_status column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'checklist_items' 
    AND column_name = 'approval_status'
  ) THEN
    ALTER TABLE public.checklist_items 
      ADD COLUMN approval_status TEXT DEFAULT 'pending';
    
    -- Add check constraint
    ALTER TABLE public.checklist_items 
      ADD CONSTRAINT checklist_items_approval_status_check 
      CHECK (approval_status IN ('pending', 'approved', 'rejected'));
  END IF;

  -- Add approved_by column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'checklist_items' 
    AND column_name = 'approved_by'
  ) THEN
    ALTER TABLE public.checklist_items 
      ADD COLUMN approved_by UUID REFERENCES public.employees(id) ON DELETE SET NULL;
  END IF;

  -- Add approved_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'checklist_items' 
    AND column_name = 'approved_at'
  ) THEN
    ALTER TABLE public.checklist_items 
      ADD COLUMN approved_at TIMESTAMPTZ;
  END IF;

  -- Add rejection_reason column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'checklist_items' 
    AND column_name = 'rejection_reason'
  ) THEN
    ALTER TABLE public.checklist_items 
      ADD COLUMN rejection_reason TEXT;
  END IF;
END $$;

-- Update existing records to have 'pending' status if null
UPDATE public.checklist_items 
SET approval_status = 'pending' 
WHERE approval_status IS NULL;

-- Create index for approval_status if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_checklist_items_approval_status ON public.checklist_items(approval_status);

