-- Internal edge functions (populate-book-description, send-digest) were callable by
-- anyone who had the public anon key. Give the database a private shared secret that
-- the callers send and the functions verify.

CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS private.function_secrets (
  name text PRIMARY KEY,
  secret text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE private.function_secrets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.function_secrets FROM anon, authenticated;

INSERT INTO private.function_secrets (name, secret)
VALUES ('internal_invoke', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.trigger_populate_book_description()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_secret text;
BEGIN
  IF NEW.source_url IS NOT NULL OR NEW.description IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT secret INTO v_secret FROM private.function_secrets WHERE name = 'internal_invoke';

  PERFORM net.http_post(
    url     := 'https://kdkbmeprdbdvdrrutawr.supabase.co/functions/v1/populate-book-description',
    body    := json_build_object('book_id', NEW.id)::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', v_secret
    )
  );

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.send_daily_digest()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_secret text;
BEGIN
  SELECT secret INTO v_secret FROM private.function_secrets WHERE name = 'internal_invoke';

  PERFORM net.http_post(
    url     := 'https://kdkbmeprdbdvdrrutawr.supabase.co/functions/v1/send-digest',
    body    := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', v_secret
    )
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.send_daily_digest() FROM anon, authenticated, public;
