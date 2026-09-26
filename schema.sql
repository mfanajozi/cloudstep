-- =====================================================
-- CloudSTep — Neon schema
-- Real Estate & Conveyancing (South Africa)
--
-- Target:  project floral-morning-91933279 / branch production
-- Access:  Neon Data API (auth-provider: external, Clerk JWKS)
--          Role per request = `authenticated` (valid JWT) or
--          `anonymous` (no/invalid JWT). RLS + GRANTs only.
--
-- Safe to re-run: every statement is idempotent.
-- =====================================================

-- -----------------------------------------------------
-- 0. Schema-level grants
-- -----------------------------------------------------
GRANT USAGE ON SCHEMA public TO authenticated;
REVOKE ALL ON SCHEMA public FROM anonymous;

-- -----------------------------------------------------
-- 1. Shared trigger: keep updated_at fresh
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- -----------------------------------------------------
-- 2. users — a row here IS a provisioned member of the tool
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id          text PRIMARY KEY,                 -- Clerk `sub`
  full_name   text NOT NULL DEFAULT '',
  email       text NOT NULL DEFAULT '',
  phone       text,
  company     text,
  position    text,
  avatar_url  text,
  industry    text NOT NULL DEFAULT 'real-estate',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (lower(email));

DROP TRIGGER IF EXISTS trg_users_updated_at ON public.users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------
-- 3. clients — buyers / sellers / tenants
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.clients (
  id               text PRIMARY KEY,
  name             text NOT NULL,
  email            text NOT NULL,
  phone            text NOT NULL DEFAULT '',
  company          text,
  reference        text NOT NULL DEFAULT '',
  industry         text NOT NULL DEFAULT 'real-estate',
  clerk_user_id    text UNIQUE,
  status           text NOT NULL DEFAULT 'active',
  date_of_birth    date,
  anniversary_date date,
  agent_user_id    text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clients_clerk_user_id ON public.clients (clerk_user_id);
CREATE INDEX IF NOT EXISTS idx_clients_status         ON public.clients (status);
CREATE INDEX IF NOT EXISTS idx_clients_agent_user_id  ON public.clients (agent_user_id);
CREATE INDEX IF NOT EXISTS idx_clients_email          ON public.clients (lower(email));

DROP TRIGGER IF EXISTS trg_clients_updated_at ON public.clients;
CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------
-- 4. templates — journey templates (milestones as JSONB)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.templates (
  id            text PRIMARY KEY,
  name          text NOT NULL,
  industry      text NOT NULL DEFAULT 'real-estate',
  description   text NOT NULL DEFAULT '',
  milestones    jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata      jsonb,
  agent_user_id text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_templates_agent_user_id ON public.templates (agent_user_id);

DROP TRIGGER IF EXISTS trg_templates_updated_at ON public.templates;
CREATE TRIGGER trg_templates_updated_at
  BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------
-- 5. assignments — a client running a template
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assignments (
  id            text PRIMARY KEY,
  client_id     text NOT NULL REFERENCES public.clients (id) ON DELETE CASCADE,
  template_id   text,
  status        text NOT NULL DEFAULT 'Active',
  started_at    timestamptz,
  milestones    jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata      jsonb,
  agent_user_id text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assignments_client_id  ON public.assignments (client_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status     ON public.assignments (status);
CREATE INDEX IF NOT EXISTS idx_assignments_agent_user ON public.assignments (agent_user_id);

DROP TRIGGER IF EXISTS trg_assignments_updated_at ON public.assignments;
CREATE TRIGGER trg_assignments_updated_at
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------
-- 6. communication_logs — POPIA / PPRA audit trail
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.communication_logs (
  id             text PRIMARY KEY,
  client_id      text,
  client_name    text NOT NULL DEFAULT '',
  milestone_title text NOT NULL DEFAULT '',
  channel        text NOT NULL DEFAULT 'Email',
  message        text NOT NULL DEFAULT '',
  "timestamp"    timestamptz NOT NULL DEFAULT now(),
  status         text NOT NULL DEFAULT 'Sent',
  agent_user_id  text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_logs_client_id   ON public.communication_logs (client_id);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp   ON public.communication_logs ("timestamp" DESC);
CREATE INDEX IF NOT EXISTS idx_logs_agent_user  ON public.communication_logs (agent_user_id);

DROP TRIGGER IF EXISTS trg_logs_updated_at ON public.communication_logs;
CREATE TRIGGER trg_logs_updated_at
  BEFORE UPDATE ON public.communication_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- -----------------------------------------------------
-- 7. Grants for the Data API role
--    (matches the default ACL provisioned with the API,
--     restated here so the script is self-sufficient)
-- -----------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.users, public.clients, public.templates,
      public.assignments, public.communication_logs
  TO authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anonymous;

-- -----------------------------------------------------
-- 8. Row Level Security
-- -----------------------------------------------------
ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;

-- "Agent" = any signed-in member that has a row in public.users.
CREATE OR REPLACE FUNCTION public.is_member()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.users u WHERE u.id = auth.user_id());
$$;

-- ----- users -----
DROP POLICY IF EXISTS "users_read_own" ON public.users;
CREATE POLICY "users_read_own" ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.user_id());

DROP POLICY IF EXISTS "users_write_own" ON public.users;
CREATE POLICY "users_write_own" ON public.users
  FOR ALL TO authenticated
  USING (id = auth.user_id())
  WITH CHECK (id = auth.user_id());

-- ----- clients -----
DROP POLICY IF EXISTS "clients_member_all" ON public.clients;
CREATE POLICY "clients_member_all" ON public.clients
  FOR ALL TO authenticated
  USING (public.is_member())
  WITH CHECK (public.is_member());

DROP POLICY IF EXISTS "clients_read_own" ON public.clients;
CREATE POLICY "clients_read_own" ON public.clients
  FOR SELECT TO authenticated
  USING (clerk_user_id = auth.user_id());

-- POPIA: a client may soft-delete / amend their own record
DROP POLICY IF EXISTS "clients_update_own" ON public.clients;
CREATE POLICY "clients_update_own" ON public.clients
  FOR UPDATE TO authenticated
  USING (clerk_user_id = auth.user_id())
  WITH CHECK (clerk_user_id = auth.user_id());

-- ----- templates -----
DROP POLICY IF EXISTS "templates_member_all" ON public.templates;
CREATE POLICY "templates_member_all" ON public.templates
  FOR ALL TO authenticated
  USING (public.is_member())
  WITH CHECK (public.is_member());

-- ----- assignments -----
DROP POLICY IF EXISTS "assignments_member_all" ON public.assignments;
CREATE POLICY "assignments_member_all" ON public.assignments
  FOR ALL TO authenticated
  USING (public.is_member())
  WITH CHECK (public.is_member());

DROP POLICY IF EXISTS "assignments_read_own" ON public.assignments;
CREATE POLICY "assignments_read_own" ON public.assignments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = assignments.client_id
      AND c.clerk_user_id = auth.user_id()
  ));

-- ----- communication_logs -----
DROP POLICY IF EXISTS "logs_member_all" ON public.communication_logs;
CREATE POLICY "logs_member_all" ON public.communication_logs
  FOR ALL TO authenticated
  USING (public.is_member())
  WITH CHECK (public.is_member());

DROP POLICY IF EXISTS "logs_read_own" ON public.communication_logs;
CREATE POLICY "logs_read_own" ON public.communication_logs
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = communication_logs.client_id
      AND c.clerk_user_id = auth.user_id()
  ));

-- -----------------------------------------------------
-- 9. Helper: has this member completed setup?
--    SELECT public.is_member();  -> true once the users row exists
-- -----------------------------------------------------
