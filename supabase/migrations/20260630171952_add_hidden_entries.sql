
CREATE TABLE hidden_entries (
  user_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_id uuid NOT NULL REFERENCES reading_entries(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, entry_id)
);

ALTER TABLE hidden_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_hidden_entries" ON hidden_entries
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert_own_hidden_entries" ON hidden_entries
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_hidden_entries" ON hidden_entries
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
