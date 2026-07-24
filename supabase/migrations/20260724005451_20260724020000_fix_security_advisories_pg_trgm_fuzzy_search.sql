/*
# Fix security advisories: pg_trgm schema and fuzzy_search_books SECURITY INVOKER

1. Extension relocation
- pg_trgm is currently installed in the `public` schema. Move it to the `extensions`
  schema so public-facing objects are not mixed with extension internals.
- Postgres supports `ALTER EXTENSION ... SET SCHEMA` to relocate an installed extension.
- The operator class `gin_trgm_ops` will now resolve as `extensions.gin_trgm_ops`.
  Existing GIN indexes on books.title and books.author continue to work because Postgres
  updates internal type references during relocation; no index rebuild is required.

2. Function security — fuzzy_search_books
- `public.fuzzy_search_books(query_text text, limit_count int)` was SECURITY DEFINER,
  which meant it ran with the function owner's privileges and bypassed the caller's RLS.
- The function is read-only and only queries the `books` table, which is already
  readable by `authenticated` users via the `books_select` RLS policy.
- Recreate the function as SECURITY INVOKER so it runs with the caller's privileges and
  respects RLS. This removes the privilege-escalation surface while keeping the same
  behavior for legitimate callers.
- Keep EXECUTE grants on `anon` and `authenticated` so the frontend RPC call still works.
- Revoke EXECUTE from PUBLIC to prevent unintended roles from calling it.
- search_path pinned to `public, extensions` so trigram operators resolve correctly
  regardless of the caller's search_path.

3. Notes
- No table structure or data changes.
- Idempotent: DROP FUNCTION IF EXISTS before re-creating; ALTER EXTENSION SET SCHEMA
  is safe to re-run.
*/

-- 1. Relocate pg_trgm from public to extensions
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- 2. Recreate fuzzy_search_books as SECURITY INVOKER
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
SECURITY INVOKER
SET search_path = public, extensions
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