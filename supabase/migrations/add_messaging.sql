-- ── Internal Staff Messaging ──────────────────────────────────────────────────

-- Conversations (1-on-1 or group)
CREATE TABLE IF NOT EXISTS conversations (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT,                              -- null for direct, set for groups
  type         TEXT        DEFAULT 'direct',      -- direct | group | broadcast
  participants TEXT[]      NOT NULL DEFAULT '{}', -- array of staff_accounts.id
  created_by   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()          -- bump on every new message
);

CREATE INDEX IF NOT EXISTS idx_conversations_participants
  ON conversations USING GIN(participants);

CREATE INDEX IF NOT EXISTS idx_conversations_updated
  ON conversations (updated_at DESC);

-- Messages
CREATE TABLE IF NOT EXISTS messages (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id   UUID        NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id         TEXT        NOT NULL,
  sender_name       TEXT        NOT NULL,
  content           TEXT        NOT NULL,
  message_type      TEXT        DEFAULT 'text',   -- text | urgent | system | shared_animal | shared_call
  shared_record_id  TEXT,
  shared_record_type TEXT,
  is_deleted        BOOLEAN     DEFAULT false,
  reply_to_id       UUID        REFERENCES messages(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON messages (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_sender
  ON messages (sender_id);

-- Per-message read receipts
CREATE TABLE IF NOT EXISTS message_read_status (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID        NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id    TEXT        NOT NULL,
  read_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_read_status_user
  ON message_read_status (user_id, message_id);

-- RLS — allow all (app-level auth, matching the rest of the codebase)
ALTER TABLE conversations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages             ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_read_status  ENABLE ROW LEVEL SECURITY;

CREATE POLICY allow_all_conversations       ON conversations       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all_messages            ON messages            FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY allow_all_message_read_status ON message_read_status FOR ALL USING (true) WITH CHECK (true);

-- Trigger: bump conversations.updated_at when a new message is inserted
CREATE OR REPLACE FUNCTION bump_conversation_updated()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE conversations SET updated_at = NOW() WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bump_conversation
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION bump_conversation_updated();

-- Enable Supabase Realtime on the messages table so clients receive
-- INSERT events instantly without polling.
-- Run this line in the Supabase Dashboard → SQL Editor:
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
