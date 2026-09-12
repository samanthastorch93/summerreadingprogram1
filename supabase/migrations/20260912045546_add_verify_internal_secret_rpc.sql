-- Verifier callable only by the service role, so internal edge functions can check
-- the shared secret through the Data API without exposing the private schema.
CREATE OR REPLACE FUNCTION public.verify_internal_secret(p_secret text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_secret text;
BEGIN
  IF p_secret IS NULL OR length(p_secret) = 0 THEN
    RETURN false;
  END IF;
  SELECT secret INTO v_secret FROM private.function_secrets WHERE name = 'internal_invoke';
  IF v_secret IS NULL THEN
    RETURN false;
  END IF;
  RETURN v_secret = p_secret;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.verify_internal_secret(text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_internal_secret(text) TO service_role;
