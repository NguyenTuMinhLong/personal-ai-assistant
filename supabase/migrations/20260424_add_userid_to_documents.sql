-- Migration: Add userId column to documents table
-- Run this in your Supabase SQL Editor

-- 1. Add userId column to documents table
ALTER TABLE documents ADD COLUMN IF NOT EXISTS user_id TEXT;

-- 2. Create index for faster user-based queries
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);

-- 3. Enable RLS on documents table if not already enabled
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- 4. Create RLS policy: users can only see their own documents
-- Drop existing policies first to avoid duplicates
DROP POLICY IF EXISTS "Users can view their own documents" ON documents;
DROP POLICY IF EXISTS "Users can insert their own documents" ON documents;
DROP POLICY IF EXISTS "Users can delete their own documents" ON documents;

CREATE POLICY "Users can view their own documents"
  ON documents FOR SELECT
  USING (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can insert their own documents"
  ON documents FOR INSERT
  WITH CHECK (auth.uid()::TEXT = user_id);

CREATE POLICY "Users can delete their own documents"
  ON documents FOR DELETE
  USING (auth.uid()::TEXT = user_id);
