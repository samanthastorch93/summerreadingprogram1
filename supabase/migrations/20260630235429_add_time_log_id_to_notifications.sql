ALTER TABLE notifications ADD COLUMN IF NOT EXISTS time_log_id uuid REFERENCES time_logs(id) ON DELETE CASCADE;
