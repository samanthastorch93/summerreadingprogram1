/*
# Add fuzzy_search_books RPC function

1. New Functions
- `fuzzy_search_books(query_text text, limit_count int)`:
  Searches the `books` table using trigram similarity (pg_trgm) for typo-tolerant matching.
  Compares the query against both title and author, takes the best similarity score per row,
  and returns rows sorted by relevance. Uses a similarity threshold of 0.1 so very loose
  matches still surface, but exact matches rank first.

2. Security
- Function is SECURITY DEFINER with `SET search_path = public`.
- Granted EXECUTE to `anon` and `authenticated` roles so both the anon-key frontend
  and signed-in users can call it.
- No data is mutated; read-only.

3. Notes
- Depends on the pg_trgm extension (enabled in prior migration).
- Idempotent: uses DROP FUNCTION IF EXISTS before CREATE.
*/

DROP FUNCTION IF EXISTS public.fuzzy_search_books(text, int);

CREATE FUNCTION public.fuzzy_search_books(query_text text, limit_count int DEFAULT 10)
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
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
    GREATEST(
      similarity(b.title, query_text),
      similarity(b.author, query_text),
      word_similarity(query_text, b.title),
      word_similarity(query_text, b.author)
    ) AS rank
  FROM books b
  WHERE
    b.title % query_text
    OR b.author % query_text
    OR word_similarity(query_text, b.title) > 0.3
    OR word_similarity(query_text, b.author) > 0.3
    OR b.title ILIKE '%' || query_text || '%'
    OR b.author ILIKE '%' || query_text || '%'
  ORDER BY rank DESC
  LIMIT GREATEST(limit_count, 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fuzzy_search_books(text, int) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.fuzzy_search_books(text, int) FROM PUBLIC;
