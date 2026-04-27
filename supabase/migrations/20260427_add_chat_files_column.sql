-- Migration: Add chat_files column to messages table
-- Run this in your Supabase SQL Editor
-- https://supabase.com/dashboard/project/YOUR_PROJECT/sql

ALTER TABLE messages ADD COLUMN IF NOT EXISTS chat_files JSONB;
