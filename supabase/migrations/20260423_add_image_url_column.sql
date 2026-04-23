-- Migration: Fix database schema for personal-ai-assistant
-- Run this in your Supabase SQL Editor

-- 1. Add image_url column to messages table
ALTER TABLE messages ADD COLUMN IF NOT EXISTS image_url TEXT;

-- 2. Ensure message_annotations table has all needed columns
ALTER TABLE message_annotations ADD COLUMN IF NOT EXISTS note_content TEXT;
ALTER TABLE message_annotations ADD COLUMN IF NOT EXISTS highlight_color TEXT;
ALTER TABLE message_annotations ADD COLUMN IF NOT EXISTS selection_start INTEGER;
ALTER TABLE message_annotations ADD COLUMN IF NOT EXISTS selection_end INTEGER;

-- 3. Create unique constraint for annotations if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'message_annotations_user_message_unique'
  ) THEN
    ALTER TABLE message_annotations ADD CONSTRAINT message_annotations_user_message_unique
    UNIQUE (user_id, message_id);
  END IF;
EXCEPTION WHEN others THEN
  -- Ignore if constraint already exists or other error
END $$;

-- 4. Make sure chat_sessions table has proper indexes
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_document_id ON chat_sessions(document_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(updated_at);

-- 5. Make sure messages table has proper indexes
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);

-- 6. Make sure annotations table has proper indexes
CREATE INDEX IF NOT EXISTS idx_message_annotations_session_id ON message_annotations(session_id);
CREATE INDEX IF NOT EXISTS idx_message_annotations_message_id ON message_annotations(message_id);
