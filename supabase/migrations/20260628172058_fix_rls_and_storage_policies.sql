-- 1. Add created_by to books and auto-fill it on INSERT via trigger
ALTER TABLE books ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION books_set_created_by()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  NEW.created_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_books_set_created_by ON books;
CREATE TRIGGER trg_books_set_created_by
  BEFORE INSERT ON books
  FOR EACH ROW EXECUTE FUNCTION books_set_created_by();

-- Fix books_insert: created_by must equal the inserting user
DROP POLICY IF EXISTS "books_insert" ON books;
CREATE POLICY "books_insert" ON books FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Fix books_update: only users with an entry for the book, or moderators
DROP POLICY IF EXISTS "books_update" ON books;
CREATE POLICY "books_update" ON books FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM reading_entries WHERE book_id = books.id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_moderator = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM reading_entries WHERE book_id = books.id AND user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_moderator = true)
  );

-- 2. Fix notifications_insert: sender must be the authenticated user
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert" ON notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_user_id);

-- 3. Fix storage listing: drop the 3 broad SELECT policies on the media bucket.
--    Public bucket files remain accessible via their public CDN URLs (no RLS required).
DROP POLICY IF EXISTS "media_public_read" ON storage.objects;
DROP POLICY IF EXISTS "media_read_anon" ON storage.objects;
DROP POLICY IF EXISTS "media_read_policy" ON storage.objects;

-- Add a scoped SELECT policy so authenticated users can only read their own uploads.
-- Cover images are in covers/ (shared), user assets are in folders named by user ID.
-- Public URL access is unaffected by this change.
CREATE POLICY "media_read_own" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'media');
