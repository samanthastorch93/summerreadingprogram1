ALTER TABLE notifications ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'mention';
