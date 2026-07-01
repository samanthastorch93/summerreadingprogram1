-- Backfill comment notifications: one per comment where commenter != entry owner
INSERT INTO notifications (recipient_id, sender_user_id, comment_id, entry_id, type, read, created_at)
SELECT
  re.user_id       AS recipient_id,
  c.user_id        AS sender_user_id,
  c.id             AS comment_id,
  c.entry_id,
  'comment'        AS type,
  true             AS read,
  c.created_at
FROM comments c
JOIN reading_entries re ON re.id = c.entry_id
WHERE c.user_id <> re.user_id
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.comment_id = c.id
      AND n.recipient_id = re.user_id
      AND n.type = 'comment'
  );

-- Backfill mention notifications: parse @username from comment content
INSERT INTO notifications (recipient_id, sender_user_id, comment_id, entry_id, type, read, created_at)
SELECT DISTINCT
  p.id             AS recipient_id,
  c.user_id        AS sender_user_id,
  c.id             AS comment_id,
  c.entry_id,
  'mention'        AS type,
  true             AS read,
  c.created_at
FROM comments c
JOIN profiles p
  ON p.username = ANY(
    ARRAY(
      SELECT lower(m[1])
      FROM regexp_matches(c.content, '@([A-Za-z0-9_]+)', 'g') AS m
    )
  )
WHERE p.id <> c.user_id
  AND NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.comment_id = c.id
      AND n.recipient_id = p.id
      AND n.type = 'mention'
  );
