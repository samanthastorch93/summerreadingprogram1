-- F4: media_auth_update checked only the bucket, letting any authenticated user
-- overwrite (upsert) any other user's stored image. Restrict to the uploader, and
-- add a WITH CHECK so a file cannot be moved into another user's folder.
DROP POLICY IF EXISTS "media_auth_update" ON storage.objects;

CREATE POLICY "media_auth_update" ON storage.objects
  FOR UPDATE TO authenticated
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
  )
  WITH CHECK (
    bucket_id = 'media'
    AND (
      owner = auth.uid()
      OR (storage.foldername(name))[1] = auth.uid()::text
      OR (storage.foldername(name))[2] = auth.uid()::text
    )
  );

-- Duplicate INSERT policy: media_upload_policy and media_auth_upload are identical.
DROP POLICY IF EXISTS "media_upload_policy" ON storage.objects;
