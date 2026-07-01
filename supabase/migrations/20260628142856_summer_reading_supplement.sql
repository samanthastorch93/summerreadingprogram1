/*
# Summer Reading - Supplement Schema

Adds missing sender_user_id column, missing policies, and performance indexes.
All statements are idempotent.
*/

-- Add sender_user_id to notifications if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'notifications'
      AND column_name = 'sender_user_id'
  ) THEN
    ALTER TABLE notifications
      ADD COLUMN sender_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Missing policies
DROP POLICY IF EXISTS "comments_update" ON comments;
CREATE POLICY "comments_update" ON comments FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notifications_delete" ON notifications;
CREATE POLICY "notifications_delete" ON notifications FOR DELETE TO authenticated
  USING (auth.uid() = recipient_id);

DROP POLICY IF EXISTS "books_update" ON books;
CREATE POLICY "books_update" ON books FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "profiles_delete" ON profiles;
CREATE POLICY "profiles_delete" ON profiles FOR DELETE TO authenticated USING (auth.uid() = id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_entries_user_id ON reading_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_entries_book_id ON reading_entries(book_id);
CREATE INDEX IF NOT EXISTS idx_entries_status ON reading_entries(status);
CREATE INDEX IF NOT EXISTS idx_entries_created_at ON reading_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_entry_id ON comments(entry_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(recipient_id, read) WHERE NOT read;
