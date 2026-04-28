-- Migration: add feedback + analytics tables + RLS
-- Run this in Supabase SQL Editor or via `npx supabase db push`

-- ─── Usage events ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.usage_events (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     TEXT        NOT NULL,
  event_type  TEXT        NOT NULL,
  event_data  JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS usage_events_user_id_idx      ON public.usage_events (user_id);
CREATE INDEX IF NOT EXISTS usage_events_event_type_idx   ON public.usage_events (event_type);
CREATE INDEX IF NOT EXISTS usage_events_created_at_idx    ON public.usage_events (created_at DESC);

-- ─── Message feedback ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.message_feedback (
  id          UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id  TEXT        NOT NULL,
  user_id     TEXT        NOT NULL,
  vote        TEXT        NOT NULL CHECK (vote IN ('up', 'down')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS message_feedback_message_id_idx ON public.message_feedback (message_id);
CREATE INDEX IF NOT EXISTS message_feedback_user_id_idx    ON public.message_feedback (user_id);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.usage_events      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_feedback  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usage_events_user_access"      ON public.usage_events;
CREATE POLICY "usage_events_user_access"
  ON public.usage_events FOR ALL
  TO authenticated
  USING (auth.uid()::TEXT = user_id)
  WITH CHECK (auth.uid()::TEXT = user_id);

DROP POLICY IF EXISTS "message_feedback_user_access"  ON public.message_feedback;
CREATE POLICY "message_feedback_user_access"
  ON public.message_feedback FOR ALL
  TO authenticated
  USING (auth.uid()::TEXT = user_id)
  WITH CHECK (auth.uid()::TEXT = user_id);
