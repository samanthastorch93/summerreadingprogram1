/*
# Add comment_likes table

1. New Tables
- `comment_likes`
  - `id` (uuid, primary key)
  - `comment_id` (uuid, fk -> comments.id, cascade delete)
  - `user_id` (uuid, fk -> auth.users.id, defaults to auth.uid())
  - `created_at` (timestamptz)
  - Unique constraint on (comment_id, user_id) — one like per user per comment

2. Security
- Enable RLS on `comment_likes`
- Authenticated users can read all likes (to show counts/state)
- Authenticated users can insert/delete their own likes only
*/

CREATE TABLE IF NOT EXISTS comment_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (comment_id, user_id)
);

ALTER TABLE comment_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_comment_likes" ON comment_likes;
CREATE POLICY "select_comment_likes" ON comment_likes FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_comment_like" ON comment_likes;
CREATE POLICY "insert_own_comment_like" ON comment_likes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_comment_like" ON comment_likes;
CREATE POLICY "delete_own_comment_like" ON comment_likes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);
