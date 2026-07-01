-- Revoke from PUBLIC (which covers anon + authenticated).
-- Explicit role grants to postgres and service_role are preserved.
REVOKE EXECUTE ON FUNCTION public.trigger_populate_book_description() FROM PUBLIC;
