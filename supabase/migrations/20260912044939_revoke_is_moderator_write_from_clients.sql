-- F1: the row-level profiles_update policy lets a user update every column of their
-- own row, including the privilege column is_moderator. Remove the column privilege
-- so no client role can write it; moderator status is assigned out of band.
REVOKE UPDATE (is_moderator) ON public.profiles FROM anon, authenticated;
REVOKE INSERT (is_moderator) ON public.profiles FROM anon, authenticated;
