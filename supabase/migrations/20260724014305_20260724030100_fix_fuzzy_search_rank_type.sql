/*
# Fix fuzzy_search_books rank column type

The rank expression returns double precision but the function declares it as real.
Add an explicit cast to real.
*/

DROP FUNCTION IF EXISTS public.fuzzy_search_books(text, text, int);

CREATE FUNCTION public.fuzzy_search_books(search_title text, search_author text, limit_count int DEFAULT 10)
RETURNS TABLE (
  id uuid,
  title text,
  author text,
  isbn text,
  cover_url text,
  open_library_cover_id text,
  description text,
  bookshop_url text,
  source_url text,
  rank real
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, extensions
AS $$
DECLARE
  has_title boolean := search_title IS NOT NULL AND btrim(search_title) <> '';
  has_author boolean := search_author IS NOT NULL AND btrim(search_author) <> '';
BEGIN
  IF NOT has_title AND NOT has_author THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    b.id,
    b.title,
    b.author,
    b.isbn,
    b.cover_url,
    b.open_library_cover_id,
    b.description,
    b.bookshop_url,
    b.source_url,
    (
      GREATEST(
        similarity(b.title, COALESCE(search_title, '')),
        word_similarity(COALESCE(search_title, ''), b.title)
      ) * CASE WHEN has_title THEN 1.0 ELSE 0.0 END
      +
      GREATEST(
        similarity(b.author, COALESCE(search_author, '')),
        word_similarity(COALESCE(search_author, ''), b.author)
      ) * CASE WHEN has_author THEN 1.0 ELSE 0.0 END
    )::real AS rank
  FROM books b
  WHERE
    (has_title AND (
      b.title % search_title
      OR word_similarity(search_title, b.title) > 0.3
      OR b.title ILIKE '%' || search_title || '%'
    ))
    OR
    (has_author AND (
      b.author % search_author
      OR word_similarity(search_author, b.author) > 0.3
      OR b.author ILIKE '%' || search_author || '%'
    ))
  ORDER BY
    CASE WHEN has_author THEN
      GREATEST(similarity(b.author, search_author), word_similarity(search_author, b.author))
    ELSE 0 END DESC,
    rank DESC
  LIMIT GREATEST(limit_count, 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fuzzy_search_books(text, text, int) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fuzzy_search_books(text, text, int) FROM PUBLIC;