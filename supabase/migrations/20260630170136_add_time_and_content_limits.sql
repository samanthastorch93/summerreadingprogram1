ALTER TABLE reading_entries
  ADD CONSTRAINT reading_entries_time_cap CHECK (time_read_minutes <= 3000);

ALTER TABLE time_logs
  ADD CONSTRAINT time_logs_time_cap CHECK (minutes_added <= 600);
