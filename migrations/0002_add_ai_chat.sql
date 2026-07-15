-- Migration: 0002_add_ai_chat
ALTER TABLE blobs ADD COLUMN ai_chat_history TEXT;
