-- Enable pg_net for async HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- Trigger function: fires the populate-book-description edge function on new book inserts
CREATE OR REPLACE FUNCTION trigger_populate_book_description()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Skip articles (source_url is set) and books already having a description
  IF NEW.source_url IS NOT NULL OR NEW.description IS NOT NULL THEN
    RETURN NEW;
  END IF;

  PERFORM extensions.http_post(
    url    := 'https://kdkbmeprdbdvdrrutawr.supabase.co/functions/v1/populate-book-description',
    body   := json_build_object('book_id', NEW.id)::text,
    params := '{}'::text,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtka2JtZXByZGJkdmRycnV0YXdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MzYxNTEsImV4cCI6MjA5ODIxMjE1MX0.y_5s2JWswLF-tzMGmZ3aBuagJWIJko5GtG7ioPfFRAg'
    )::text
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_book_insert_populate_description
  AFTER INSERT ON books
  FOR EACH ROW
  EXECUTE FUNCTION trigger_populate_book_description();
