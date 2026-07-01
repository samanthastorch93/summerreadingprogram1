
-- 1. Fix mutable search_path on trigger function
CREATE OR REPLACE FUNCTION public.books_set_created_by()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Revoke direct RPC execution from anon and authenticated
--    (it is a trigger function — should never be called directly)
REVOKE EXECUTE ON FUNCTION public.books_set_created_by() FROM anon;
REVOKE EXECUTE ON FUNCTION public.books_set_created_by() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.books_set_created_by() TO postgres;

-- 3. Drop the broad storage SELECT policy that exposes full bucket listing
DROP POLICY IF EXISTS "media_read_own" ON storage.objects;

-- Replace with a tight policy: only allow reading objects in known sub-paths
-- (avatars/* and entries/*) and only the object URL itself — no wildcard listing
CREATE POLICY "media_select_public_objects"
  ON storage.objects FOR SELECT
  TO public
  USING (
    bucket_id = 'media'
    AND (
      (storage.foldername(name))[1] = 'avatars'
      OR (storage.foldername(name))[1] = 'entries'
      OR (storage.foldername(name))[1] = 'comments'
    )
  );
