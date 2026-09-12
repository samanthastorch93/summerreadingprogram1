-- F3: media_auth_delete checked only the bucket, letting any authenticated user
-- delete any other user's avatar, cover, entry or comment image.
-- Restrict to the uploader (storage sets owner on insert) or a path segment that
-- matches the caller's id, with a moderator escape hatch.
DROP POLICY IF EXISTS "media_auth_delete" ON storage.objects;

CREATE POLICY "media_auth_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'media'
    AND (
      owner = auth.uid()
      OR (storage.foldername(name))[1] = auth.uid()::text
      OR (storage.foldername(name))[2] = auth.uid()::text
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid() AND profiles.is_moderator = true
      )
    )
  );
