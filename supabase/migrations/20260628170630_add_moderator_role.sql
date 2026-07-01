-- Add moderator flag to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_moderator boolean NOT NULL DEFAULT false;

-- Update delete policies to allow moderators to delete any row
DROP POLICY IF EXISTS "comments_delete" ON comments;
CREATE POLICY "comments_delete" ON comments FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_moderator = true
    )
  );

DROP POLICY IF EXISTS "entries_delete" ON reading_entries;
CREATE POLICY "entries_delete" ON reading_entries FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_moderator = true
    )
  );

DROP POLICY IF EXISTS "delete_own_time_logs" ON time_logs;
CREATE POLICY "delete_own_time_logs" ON time_logs FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND is_moderator = true
    )
  );
