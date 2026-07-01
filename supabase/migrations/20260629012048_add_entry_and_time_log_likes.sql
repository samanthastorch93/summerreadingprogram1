CREATE TABLE IF NOT EXISTS entry_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_id uuid NOT NULL REFERENCES reading_entries(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, entry_id)
);

ALTER TABLE entry_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_entry_likes" ON entry_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_own_entry_likes" ON entry_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_entry_likes" ON entry_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS time_log_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  time_log_id uuid NOT NULL REFERENCES time_logs(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, time_log_id)
);

ALTER TABLE time_log_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_time_log_likes" ON time_log_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_own_time_log_likes" ON time_log_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "delete_own_time_log_likes" ON time_log_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);