-- Migration: add guest_sessions table for anonymous/guest user tracking
-- Run this in Supabase SQL Editor or via `npx supabase db push`

CREATE TABLE IF NOT EXISTS public.guest_sessions (
  id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  anonymous_id    TEXT        NOT NULL UNIQUE,
  message_count   INTEGER     NOT NULL DEFAULT 0,
  upload_used     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS guest_sessions_anonymous_id_idx ON public.guest_sessions (anonymous_id);

-- RLS
ALTER TABLE public.guest_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "guest_sessions_owner_access" ON public.guest_sessions;
CREATE POLICY "guest_sessions_owner_access"
  ON public.guest_sessions FOR ALL
  TO authenticated
  USING (auth.uid()::TEXT = anonymous_id)
  WITH CHECK (auth.uid()::TEXT = anonymous_id);

-- Note: anonymous sign-in users have a special auth.uid() format.
-- The anonymous_id stored here should match the Clerk user ID or
-- Supabase anonymous ID. For Supabase anonymous sign-in, the anon ID
-- is the same as the Supabase user ID (auth.uid()).
