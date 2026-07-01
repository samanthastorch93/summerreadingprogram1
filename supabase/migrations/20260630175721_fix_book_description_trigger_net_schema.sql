CREATE OR REPLACE FUNCTION trigger_populate_book_description()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.source_url IS NOT NULL OR NEW.description IS NOT NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := 'https://kdkbmeprdbdvdrrutawr.supabase.co/functions/v1/populate-book-description',
    body    := json_build_object('book_id', NEW.id)::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtka2JtZXByZGJkdmRycnV0YXdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MzYxNTEsImV4cCI6MjA5ODIxMjE1MX0.y_5s2JWswLF-tzMGmZ3aBuagJWIJko5GtG7ioPfFRAg'
    )
  );

  RETURN NEW;
END;
$$;
