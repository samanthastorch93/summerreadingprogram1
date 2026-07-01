-- Enable pg_cron for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Wrapper function called by pg_cron each day
CREATE OR REPLACE FUNCTION public.send_daily_digest()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM net.http_post(
    url     := 'https://kdkbmeprdbdvdrrutawr.supabase.co/functions/v1/send-digest',
    body    := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtka2JtZXByZGJkdmRycnV0YXdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2MzYxNTEsImV4cCI6MjA5ODIxMjE1MX0.y_5s2JWswLF-tzMGmZ3aBuagJWIJko5GtG7ioPfFRAg'
    )
  );
END;
$$;

-- Lock down access — only postgres (pg_cron daemon) can call this
REVOKE EXECUTE ON FUNCTION public.send_daily_digest() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.send_daily_digest() FROM anon;
REVOKE EXECUTE ON FUNCTION public.send_daily_digest() FROM authenticated;

-- Remove any pre-existing job with this name before (re-)scheduling
DO $$
BEGIN
  PERFORM cron.unschedule('daily-digest');
EXCEPTION WHEN OTHERS THEN
  NULL;  -- job didn't exist yet, that's fine
END $$;

-- 8:00 AM UTC every day
SELECT cron.schedule(
  'daily-digest',
  '0 8 * * *',
  'SELECT public.send_daily_digest()'
);
