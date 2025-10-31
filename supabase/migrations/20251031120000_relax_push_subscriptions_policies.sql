-- Relax RLS policies for push_subscriptions to match app's simple auth model
-- Drop existing specific policies if they exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'push_subscriptions' AND policyname = 'Users can view their own subscriptions'
  ) THEN
    EXECUTE 'DROP POLICY "Users can view their own subscriptions" ON public.push_subscriptions';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'push_subscriptions' AND policyname = 'Users can create their own subscriptions'
  ) THEN
    EXECUTE 'DROP POLICY "Users can create their own subscriptions" ON public.push_subscriptions';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'push_subscriptions' AND policyname = 'Users can delete their own subscriptions'
  ) THEN
    EXECUTE 'DROP POLICY "Users can delete their own subscriptions" ON public.push_subscriptions';
  END IF;
END $$;

-- Create permissive policies similar to other tables in this project
CREATE POLICY "Allow all to read push_subscriptions" ON public.push_subscriptions FOR SELECT USING (true);
CREATE POLICY "Allow all to manage push_subscriptions" ON public.push_subscriptions FOR ALL USING (true) WITH CHECK (true);


