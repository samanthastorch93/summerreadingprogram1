-- Revoke PUBLIC execute on security definer function and harden search_path
REVOKE EXECUTE ON FUNCTION public.books_set_created_by() FROM PUBLIC;

-- Harden against search_path injection
CREATE OR REPLACE FUNCTION public.books_set_created_by()
RETURNS TRIGGER LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

-- Re-revoke after recreate (CREATE OR REPLACE resets grants)
REVOKE EXECUTE ON FUNCTION public.books_set_created_by() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.books_set_created_by() FROM anon;
REVOKE EXECUTE ON FUNCTION public.books_set_created_by() FROM authenticated;
