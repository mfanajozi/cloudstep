-- =====================================================
-- CloudSTep — migration: Clerk -> Neon Managed Better Auth
--
-- Target: project floral-morning-91933279 / branch production
-- Idempotent: safe to re-run.
--
-- ORDER MATTERS:
--   1. users gains role/username  ->  THEN is_admin() can be created
--      (LANGUAGE sql bodies are analyzed at creation time)
--   2. old policies dropped        ->  THEN clients.clerk_user_id
--      can be dropped (policies depend on it)
--   3. new per-owner policies created last
--
-- NOTE ON auth.user_id()
--   The `auth` schema is owned by Neon's `cloud_admin` and
--   `GRANT USAGE ... TO authenticated` is silently ignored by
--   this project, so `auth.user_id()` raises
--   "permission denied for schema auth". public.current_user_id()
--   reads the same claim (JWT `sub`) from request.jwt.claims,
--   which the Data API sets on every request.
-- =====================================================

-- -----------------------------------------------------
-- 1. users: username, role, setup gate
-- -----------------------------------------------------
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS username       text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role           text NOT NULL DEFAULT 'owner';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS setup_complete boolean NOT NULL DEFAULT false;

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check CHECK (role IN ('admin', 'owner'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON public.users (lower(username));
CREATE INDEX        IF NOT EXISTS idx_users_role     ON public.users (role);

-- -----------------------------------------------------
-- 2. Request identity helpers
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub';
$$;

CREATE OR REPLACE FUNCTION public.is_member()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = public.current_user_id());
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users u
    WHERE u.id = public.current_user_id() AND u.role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.current_user_id() TO authenticated, anonymous;
GRANT EXECUTE ON FUNCTION public.is_member()        TO authenticated, anonymous;
GRANT EXECUTE ON FUNCTION public.is_admin()         TO authenticated, anonymous;

-- -----------------------------------------------------
-- 3. Drop every legacy policy (incl. those reading clerk_user_id)
-- -----------------------------------------------------
DROP POLICY IF EXISTS "users_read_own"        ON public.users;
DROP POLICY IF EXISTS "users_write_own"       ON public.users;
DROP POLICY IF EXISTS "users_select_own"      ON public.users;
DROP POLICY IF EXISTS "users_manage"          ON public.users;

DROP POLICY IF EXISTS "clients_member_all"    ON public.clients;
DROP POLICY IF EXISTS "clients_read_own"      ON public.clients;
DROP POLICY IF EXISTS "clients_update_own"    ON public.clients;
DROP POLICY IF EXISTS "clients_owner_all"     ON public.clients;

DROP POLICY IF EXISTS "templates_member_all"  ON public.templates;
DROP POLICY IF EXISTS "templates_owner_all"   ON public.templates;

DROP POLICY IF EXISTS "assignments_member_all" ON public.assignments;
DROP POLICY IF EXISTS "assignments_read_own"   ON public.assignments;
DROP POLICY IF EXISTS "assignments_owner_all"  ON public.assignments;

DROP POLICY IF EXISTS "logs_member_all"       ON public.communication_logs;
DROP POLICY IF EXISTS "logs_read_own"         ON public.communication_logs;
DROP POLICY IF EXISTS "logs_owner_all"        ON public.communication_logs;

-- -----------------------------------------------------
-- 4. clients: drop the client-portal link column
-- -----------------------------------------------------
ALTER TABLE public.clients DROP COLUMN IF EXISTS clerk_user_id;

-- -----------------------------------------------------
-- 5. Ownership columns default to the caller and are required
-- -----------------------------------------------------
ALTER TABLE public.clients
  ALTER COLUMN agent_user_id SET DEFAULT public.current_user_id();
ALTER TABLE public.templates
  ALTER COLUMN agent_user_id SET DEFAULT public.current_user_id();
ALTER TABLE public.assignments
  ALTER COLUMN agent_user_id SET DEFAULT public.current_user_id();
ALTER TABLE public.communication_logs
  ALTER COLUMN agent_user_id SET DEFAULT public.current_user_id();

ALTER TABLE public.clients
  ALTER COLUMN agent_user_id SET NOT NULL;
ALTER TABLE public.templates
  ALTER COLUMN agent_user_id SET NOT NULL;
ALTER TABLE public.assignments
  ALTER COLUMN agent_user_id SET NOT NULL;
ALTER TABLE public.communication_logs
  ALTER COLUMN agent_user_id SET NOT NULL;

-- -----------------------------------------------------
-- 6. Seed the single admin workspace record
--    (auth user created in Neon Auth, role = admin)
-- -----------------------------------------------------
INSERT INTO public.users (id, full_name, email, username, role, setup_complete, industry)
VALUES (
  'b5c6497e-373c-47d8-b4ea-a7a89bfbbc7f',
  'Mzi Masitla',
  'masitlaem@gmail.com',
  'cloudst',
  'admin',
  true,
  'real-estate'
)
ON CONFLICT (id) DO UPDATE
  SET full_name      = EXCLUDED.full_name,
      email          = EXCLUDED.email,
      username       = EXCLUDED.username,
      role           = EXCLUDED.role,
      setup_complete = EXCLUDED.setup_complete;

-- -----------------------------------------------------
-- 7. Row Level Security — per owner, admin sees everything
-- -----------------------------------------------------
ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;

-- ----- users -----
CREATE POLICY "users_select_own" ON public.users
  FOR SELECT TO authenticated
  USING (id = public.current_user_id() OR public.is_admin());

CREATE POLICY "users_manage" ON public.users
  FOR ALL TO authenticated
  USING (id = public.current_user_id() OR public.is_admin())
  WITH CHECK (id = public.current_user_id() OR public.is_admin());

-- ----- clients -----
CREATE POLICY "clients_owner_all" ON public.clients
  FOR ALL TO authenticated
  USING (agent_user_id = public.current_user_id() OR public.is_admin())
  WITH CHECK (agent_user_id = public.current_user_id() OR public.is_admin());

-- ----- templates -----
CREATE POLICY "templates_owner_all" ON public.templates
  FOR ALL TO authenticated
  USING (agent_user_id = public.current_user_id() OR public.is_admin())
  WITH CHECK (agent_user_id = public.current_user_id() OR public.is_admin());

-- ----- assignments -----
CREATE POLICY "assignments_owner_all" ON public.assignments
  FOR ALL TO authenticated
  USING (agent_user_id = public.current_user_id() OR public.is_admin())
  WITH CHECK (agent_user_id = public.current_user_id() OR public.is_admin());

-- ----- communication_logs -----
CREATE POLICY "logs_owner_all" ON public.communication_logs
  FOR ALL TO authenticated
  USING (agent_user_id = public.current_user_id() OR public.is_admin())
  WITH CHECK (agent_user_id = public.current_user_id() OR public.is_admin());

-- -----------------------------------------------------
-- 8. Grants (restated so this script is self-sufficient)
-- -----------------------------------------------------
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.users, public.clients, public.templates,
      public.assignments, public.communication_logs
  TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

REVOKE ALL ON ALL TABLES  IN SCHEMA public FROM anonymous;
REVOKE ALL ON SCHEMA public FROM anonymous;

-- -----------------------------------------------------
-- 9. Scratch functions from the auth investigation
-- -----------------------------------------------------
DROP FUNCTION IF EXISTS public.jwt_debug();
DROP FUNCTION IF EXISTS public.uid_debug();
