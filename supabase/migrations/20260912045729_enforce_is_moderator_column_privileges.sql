-- A table-level UPDATE/INSERT grant covers every column, so the earlier column-level
-- revoke had no effect. Drop the table-level write grants and re-grant only the
-- columns members may set, leaving is_moderator writable by privileged roles only.

REVOKE UPDATE, INSERT ON public.profiles FROM anon, authenticated;

GRANT UPDATE (display_name, username, avatar_color, avatar_url)
  ON public.profiles TO authenticated;

GRANT INSERT (id, display_name, username, avatar_color, avatar_url)
  ON public.profiles TO authenticated;
