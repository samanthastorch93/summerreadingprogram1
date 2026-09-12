-- F5: books_update allowed anyone who had logged a book to rewrite the shared
-- catalog row (title, author, cover) that every other member's entry points at.
-- Books are deduplicated by title+author, so one member's edit changed what other
-- members see. Restrict edits to the row's creator or a moderator.
DROP POLICY IF EXISTS "books_update" ON public.books;

CREATE POLICY "books_update" ON public.books
  FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_moderator = true
    )
  )
  WITH CHECK (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.is_moderator = true
    )
  );
