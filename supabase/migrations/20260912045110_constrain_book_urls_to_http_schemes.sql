-- F6: books.source_url is free text supplied by the logging user and rendered as an
-- anchor href for every other reader, so a javascript: URL would execute in their
-- browser. Constrain the stored value to http(s). No existing row violates this.
ALTER TABLE public.books
  ADD CONSTRAINT books_source_url_http_only
  CHECK (source_url IS NULL OR source_url ~* '^https?://');

ALTER TABLE public.books
  ADD CONSTRAINT books_bookshop_url_http_only
  CHECK (bookshop_url IS NULL OR bookshop_url ~* '^https?://');
