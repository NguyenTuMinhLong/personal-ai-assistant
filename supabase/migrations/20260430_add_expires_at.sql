-- Migration: add expires_at column for temporary trial documents
-- Run this in Supabase SQL Editor or via `npx supabase db push`

-- Add expires_at column to documents table
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Create index for efficient cleanup queries
CREATE INDEX IF NOT EXISTS documents_expires_at_idx ON public.documents (expires_at) WHERE expires_at IS NOT NULL;

-- Create function to delete expired documents
CREATE OR REPLACE FUNCTION delete_expired_documents()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.documents WHERE expires_at IS NOT NULL AND expires_at < NOW();
END;
$$;

-- Optional: Create a cron job to run cleanup (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-expired-documents', '*/5 * * * *', 'SELECT delete_expired_documents()');
