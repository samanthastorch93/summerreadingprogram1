/*
# Add fuzzy search support for books

1. Extensions
- Enable pg_trgm (trigram matching) for typo-tolerant text similarity.
2. Indexes
- Add GIN trigram indexes on books.title and books.author to speed up similarity queries.
3. Notes
- No table structure changes; no data changes.
- The indexes support both % (LIKE with trigrams) and similarity() / word_similarity() / strict_word_similarity() lookups.
*/

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS books_title_trgm_idx ON books USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS books_author_trgm_idx ON books USING GIN (author gin_trgm_ops);
