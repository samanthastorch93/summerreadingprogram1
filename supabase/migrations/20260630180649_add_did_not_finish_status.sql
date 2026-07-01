ALTER TABLE reading_entries DROP CONSTRAINT reading_entries_status_check;
ALTER TABLE reading_entries ADD CONSTRAINT reading_entries_status_check
  CHECK (status = ANY (ARRAY['want_to_read'::text, 'reading'::text, 'finished'::text, 'did_not_finish'::text]));

ALTER TABLE time_logs DROP CONSTRAINT time_logs_status_override_check;
ALTER TABLE time_logs ADD CONSTRAINT time_logs_status_override_check
  CHECK (status_override = ANY (ARRAY['want_to_read'::text, 'reading'::text, 'finished'::text, 'did_not_finish'::text]));
