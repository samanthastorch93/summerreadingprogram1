/*
# Add time_logs table and comment threading support

## Summary
Adds discrete time-logging events and threaded comment replies.

## New Tables
- `time_logs`
  - `id` (uuid, primary key)
  - `user_id` (uuid, FK auth.users, defaults to auth.uid() — owner)
  - `entry_id` (uuid, FK reading_entries ON DELETE CASCADE)
  - `book_id` (uuid, FK books ON DELETE CASCADE — denormalized for efficient feed joins)
  - `minutes_added` (int, not null — time added in this single session)
  - `note` (text, nullable — optional annotation)
  - `created_at` (timestamptz, defaults to now())

## Modified Tables
- `comments`
  - Add `parent_comment_id` (uuid, nullable FK to comments.id ON DELETE CASCADE)
    Enables threaded replies: top-level comments have NULL, replies point to their parent.

## Security
- RLS enabled on `time_logs`
- SELECT: all authenticated users can read (social activity feed)
- INSERT: only own rows (user_id = auth.uid(), enforced by DEFAULT + WITH CHECK)
- UPDATE/DELETE: only own rows

## Notes
1. `user_id` defaults to `auth.uid()` so the frontend can call `.insert({ entry_id, book_id, minutes_added })` without threading the user ID explicitly.
2. `USING (true)` on SELECT is intentional — time logs are public social activity visible to all members.
3. `parent_comment_id` is nullable so existing comments are unaffected.
*/

CREATE TABLE IF NOT EXISTS time_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_id uuid NOT NULL REFERENCES reading_entries(id) ON DELETE CASCADE,
  book_id uuid NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  minutes_added int NOT NULL,
  note text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE time_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_time_logs" ON time_logs;
CREATE POLICY "select_time_logs" ON time_logs FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_time_logs" ON time_logs;
CREATE POLICY "insert_own_time_logs" ON time_logs FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_time_logs" ON time_logs;
CREATE POLICY "update_own_time_logs" ON time_logs FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_time_logs" ON time_logs;
CREATE POLICY "delete_own_time_logs" ON time_logs FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_time_logs_user_id ON time_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_entry_id ON time_logs(entry_id);
CREATE INDEX IF NOT EXISTS idx_time_logs_created_at ON time_logs(created_at DESC);

-- Add parent_comment_id for threaded replies (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'comments' AND column_name = 'parent_comment_id'
  ) THEN
    ALTER TABLE comments ADD COLUMN parent_comment_id uuid REFERENCES comments(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_comment_id);
