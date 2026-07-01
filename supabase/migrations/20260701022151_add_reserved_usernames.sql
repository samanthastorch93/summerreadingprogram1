CREATE TABLE reserved_usernames (
  username TEXT PRIMARY KEY,
  reserved_for UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

ALTER TABLE reserved_usernames ENABLE ROW LEVEL SECURITY;

-- Anyone can read (needed for client-side checks)
CREATE POLICY "reserved_usernames_select" ON reserved_usernames
  FOR SELECT TO anon, authenticated USING (true);

-- Seed the owner's reserved usernames
INSERT INTO reserved_usernames (username, reserved_for) VALUES
  ('samanthastorch', 'b950b2e0-ea00-4810-9db4-5abf3d5535b8'),
  ('samstorch',      'b950b2e0-ea00-4810-9db4-5abf3d5535b8'),
  ('sam',            'b950b2e0-ea00-4810-9db4-5abf3d5535b8'),
  ('storch',         'b950b2e0-ea00-4810-9db4-5abf3d5535b8'),
  ('samantha_storch','b950b2e0-ea00-4810-9db4-5abf3d5535b8'),
  ('sam_storch',     'b950b2e0-ea00-4810-9db4-5abf3d5535b8');

-- Trigger function: block reserved usernames unless claimed by the owner
CREATE OR REPLACE FUNCTION check_reserved_username()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reserved_for UUID;
BEGIN
  SELECT reserved_for INTO v_reserved_for
  FROM reserved_usernames
  WHERE username = NEW.username;

  IF FOUND AND auth.uid() IS DISTINCT FROM v_reserved_for THEN
    RAISE EXCEPTION 'Username not available.' USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION check_reserved_username() FROM PUBLIC;

CREATE TRIGGER enforce_reserved_usernames
  BEFORE INSERT OR UPDATE OF username ON profiles
  FOR EACH ROW EXECUTE FUNCTION check_reserved_username();
