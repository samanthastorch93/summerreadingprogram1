/*
# Add follows table for reader follow/unfollow

1. New Tables
- `follows`
  - `id` (uuid, primary key)
  - `follower_id` (uuid, not null, references profiles via auth.users, the user who follows)
  - `following_id` (uuid, not null, references profiles via auth.users, the user being followed)
  - `created_at` (timestamptz, default now())
  - Unique constraint on (follower_id, following_id) to prevent duplicate follows
  - Check constraint preventing self-follows

2. Security
- Enable RLS on `follows`.
- SELECT: any authenticated user can see all follows (needed for follower/following counts and to check if you follow someone)
- INSERT: authenticated users can only insert rows where they are the follower
- DELETE: authenticated users can only delete rows where they are the follower
- No UPDATE needed (follows are created/deleted, never edited)

3. Indexes
- Index on `follower_id` for querying who a user follows
- Index on `following_id` for querying a user's followers
*/

CREATE TABLE IF NOT EXISTS follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_follow UNIQUE (follower_id, following_id),
  CONSTRAINT no_self_follow CHECK (follower_id <> following_id)
);

ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_follows" ON follows;
CREATE POLICY "select_follows"
ON follows FOR SELECT
TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_follow" ON follows;
CREATE POLICY "insert_own_follow"
ON follows FOR INSERT
TO authenticated WITH CHECK (auth.uid() = follower_id);

DROP POLICY IF EXISTS "delete_own_follow" ON follows;
CREATE POLICY "delete_own_follow"
ON follows FOR DELETE
TO authenticated USING (auth.uid() = follower_id);

CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON follows(following_id);
