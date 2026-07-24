/*
# Update fuzzy_search_books to support author catalog search

1. Changes
- Replaces `fuzzy_search_books(query_text text, limit_count int)` with a new signature
  `fuzzy_search_books(search_title text, search_author text, limit_count int)`.
- When `search_author` is provided, the function returns ALL books by matching authors
  (fuzzy + ILIKE on author), ranked by author similarity then title similarity. This lets
  users type an author name and see that author's full catalog of books already in the DB.
- When only `search_title` is provided, behaves as before: fuzzy title search plus
  author fuzzy match, returns ranked results.
- When both are provided, filters to books matching the title criteria among the author's
  books.

2. Security
- Function remains SECURITY INVOKER (runs with caller's privileges, respects RLS).
- EXECUTE granted to `anon` and `authenticated`; revoked from PUBLIC.
- search_path pinned to `public, extensions` for trigram operator resolution.

3. Notes
- Read-only; no table or data changes.
- Idempotent: DROP FUNCTION IF EXISTS before CREATE.
*/

DROP FUNCTION IF EXISTS public.fuzzy_search_books(text, int);

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
      ) *
      CASE WHEN has_title THEN 1.0 ELSE 0.0 END
      +
      GREATEST(
        similarity(b.author, COALESCE(search_author, '')),
        word_similarity(COALESCE(search_author, ''), b.author)
      ) *
      CASE WHEN has_author THEN 1.0 ELSE 0.0 END
    ) AS rank
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