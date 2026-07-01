-- Backfill like notifications from entry_likes
INSERT INTO notifications (recipient_id, sender_user_id, entry_id, type, read, created_at)
SELECT
  re.user_id   AS recipient_id,
  el.user_id   AS sender_user_id,
  el.entry_id,
  'like'       AS type,
  true         AS read,
  el.created_at
FROM entry_likes el
JOIN reading_entries re ON re.id = el.entry_id
WHERE el.user_id <> re.user_id
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.entry_id = el.entry_id
      AND n.sender_user_id = el.user_id
      AND n.type = 'like'
  );

-- Backfill log_like notifications from time_log_likes
INSERT INTO notifications (recipient_id, sender_user_id, entry_id, time_log_id, type, read, created_at)
SELECT
  tl.user_id     AS recipient_id,
  tll.user_id    AS sender_user_id,
  tl.entry_id,
  tll.time_log_id,
  'log_like'     AS type,
  true           AS read,
  tll.created_at
FROM time_log_likes tll
JOIN time_logs tl ON tl.id = tll.time_log_id
WHERE tll.user_id <> tl.user_id
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.time_log_id = tll.time_log_id
      AND n.sender_user_id = tll.user_id
      AND n.type = 'log_like'
  );
