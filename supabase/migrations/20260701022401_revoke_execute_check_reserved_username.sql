-- Explicitly revoke EXECUTE on check_reserved_username from all non-privileged roles.
-- The function is a trigger function — it should only be invoked by the trigger engine,
-- never called directly via RPC.
REVOKE EXECUTE ON FUNCTION public.check_reserved_username() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_reserved_username() FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_reserved_username() FROM authenticated;
