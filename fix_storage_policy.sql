-- Fix task-photos storage policy to allow uploads without Supabase Auth
-- Run this SQL in Supabase SQL Editor to fix the upload issue
-- This app uses custom authentication, so auth.uid() is always null

-- Drop ALL existing policies for task-photos to start fresh
DROP POLICY IF EXISTS "Employees can upload task photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow uploads to task-photos bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow updates to task-photos bucket" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view task photos" ON storage.objects;

-- Ensure the bucket exists and is public
INSERT INTO storage.buckets (id, name, public) 
VALUES ('task-photos', 'task-photos', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Create fresh policies
-- Allow anyone to view task photos (bucket is public)
CREATE POLICY "Anyone can view task photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'task-photos');

-- Allow anyone to upload to task-photos bucket
-- Since the app uses custom auth, we can't use auth.uid()
CREATE POLICY "Allow uploads to task-photos bucket"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'task-photos');

-- Allow updates (for upsert operations)
CREATE POLICY "Allow updates to task-photos bucket"
ON storage.objects FOR UPDATE
USING (bucket_id = 'task-photos');

