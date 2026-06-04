-- =====================================================
-- CloudSTep: Client Profile Enhancements + Agent RLS
-- Run these statements against your Supabase project
-- =====================================================

-- 0. Normalize legacy camelCase columns to snake_case.
--    Older versions of the app wrote directly without the
--    data-layer mappers, which left columns like
--    `assignments.clientid` in the table. Rename them
--    before adding the new snake_case columns below.
--    Handles three cases per column pair:
--      a) only the camelCase column exists  -> rename it
--      b) only the snake_case column exists  -> nothing to do
--      c) both exist                          -> copy any data
--         from camelCase to snake_case (filling nulls), then
--         drop the camelCase column.
--    All steps are wrapped so the script is safe to re-run.
DO $migrate$
DECLARE
  has_camel boolean;
  has_snake boolean;
BEGIN
  -- assignments.clientid -> client_id
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='assignments' AND column_name='clientid')
    INTO has_camel;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='assignments' AND column_name='client_id')
    INTO has_snake;
  IF has_camel AND has_snake THEN
    UPDATE public.assignments SET client_id = clientid WHERE client_id IS NULL AND clientid IS NOT NULL;
    ALTER TABLE public.assignments DROP COLUMN clientid;
  ELSIF has_camel THEN
    ALTER TABLE public.assignments RENAME COLUMN clientid TO client_id;
  END IF;

  -- assignments.templateid -> template_id
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='assignments' AND column_name='templateid')
    INTO has_camel;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='assignments' AND column_name='template_id')
    INTO has_snake;
  IF has_camel AND has_snake THEN
    UPDATE public.assignments SET template_id = templateid WHERE template_id IS NULL AND templateid IS NOT NULL;
    ALTER TABLE public.assignments DROP COLUMN templateid;
  ELSIF has_camel THEN
    ALTER TABLE public.assignments RENAME COLUMN templateid TO template_id;
  END IF;

  -- assignments.startedat -> started_at
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='assignments' AND column_name='startedat')
    INTO has_camel;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='assignments' AND column_name='started_at')
    INTO has_snake;
  IF has_camel AND has_snake THEN
    UPDATE public.assignments SET started_at = startedat WHERE started_at IS NULL AND startedat IS NOT NULL;
    ALTER TABLE public.assignments DROP COLUMN startedat;
  ELSIF has_camel THEN
    ALTER TABLE public.assignments RENAME COLUMN startedat TO started_at;
  END IF;

  -- assignments.createdat -> created_at
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='assignments' AND column_name='createdat')
    INTO has_camel;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='assignments' AND column_name='created_at')
    INTO has_snake;
  IF has_camel AND has_snake THEN
    UPDATE public.assignments SET created_at = createdat WHERE created_at IS NULL AND createdat IS NOT NULL;
    ALTER TABLE public.assignments DROP COLUMN createdat;
  ELSIF has_camel THEN
    ALTER TABLE public.assignments RENAME COLUMN createdat TO created_at;
  END IF;

  -- assignments.updatedat -> updated_at
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='assignments' AND column_name='updatedat')
    INTO has_camel;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='assignments' AND column_name='updated_at')
    INTO has_snake;
  IF has_camel AND has_snake THEN
    UPDATE public.assignments SET updated_at = updatedat WHERE updated_at IS NULL AND updatedat IS NOT NULL;
    ALTER TABLE public.assignments DROP COLUMN updatedat;
  ELSIF has_camel THEN
    ALTER TABLE public.assignments RENAME COLUMN updatedat TO updated_at;
  END IF;

  -- communication_logs.clientid -> client_id
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='communication_logs' AND column_name='clientid')
    INTO has_camel;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='communication_logs' AND column_name='client_id')
    INTO has_snake;
  IF has_camel AND has_snake THEN
    UPDATE public.communication_logs SET client_id = clientid WHERE client_id IS NULL AND clientid IS NOT NULL;
    ALTER TABLE public.communication_logs DROP COLUMN clientid;
  ELSIF has_camel THEN
    ALTER TABLE public.communication_logs RENAME COLUMN clientid TO client_id;
  END IF;

  -- communication_logs.clientname -> client_name
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='communication_logs' AND column_name='clientname')
    INTO has_camel;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='communication_logs' AND column_name='client_name')
    INTO has_snake;
  IF has_camel AND has_snake THEN
    UPDATE public.communication_logs SET client_name = clientname WHERE client_name IS NULL AND clientname IS NOT NULL;
    ALTER TABLE public.communication_logs DROP COLUMN clientname;
  ELSIF has_camel THEN
    ALTER TABLE public.communication_logs RENAME COLUMN clientname TO client_name;
  END IF;

  -- communication_logs.milestonetitle -> milestone_title
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='communication_logs' AND column_name='milestonetitle')
    INTO has_camel;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='communication_logs' AND column_name='milestone_title')
    INTO has_snake;
  IF has_camel AND has_snake THEN
    UPDATE public.communication_logs SET milestone_title = milestonetitle WHERE milestone_title IS NULL AND milestonetitle IS NOT NULL;
    ALTER TABLE public.communication_logs DROP COLUMN milestonetitle;
  ELSIF has_camel THEN
    ALTER TABLE public.communication_logs RENAME COLUMN milestonetitle TO milestone_title;
  END IF;

  -- communication_logs.createdat -> created_at
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='communication_logs' AND column_name='createdat')
    INTO has_camel;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='communication_logs' AND column_name='created_at')
    INTO has_snake;
  IF has_camel AND has_snake THEN
    UPDATE public.communication_logs SET created_at = createdat WHERE created_at IS NULL AND createdat IS NOT NULL;
    ALTER TABLE public.communication_logs DROP COLUMN createdat;
  ELSIF has_camel THEN
    ALTER TABLE public.communication_logs RENAME COLUMN createdat TO created_at;
  END IF;

  -- clients.clerkuserid -> clerk_user_id
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='clients' AND column_name='clerkuserid')
    INTO has_camel;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='clients' AND column_name='clerk_user_id')
    INTO has_snake;
  IF has_camel AND has_snake THEN
    UPDATE public.clients SET clerk_user_id = clerkuserid WHERE clerk_user_id IS NULL AND clerkuserid IS NOT NULL;
    ALTER TABLE public.clients DROP COLUMN clerkuserid;
  ELSIF has_camel THEN
    ALTER TABLE public.clients RENAME COLUMN clerkuserid TO clerk_user_id;
  END IF;

  -- clients.dateofbirth -> date_of_birth
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='clients' AND column_name='dateofbirth')
    INTO has_camel;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='clients' AND column_name='date_of_birth')
    INTO has_snake;
  IF has_camel AND has_snake THEN
    UPDATE public.clients SET date_of_birth = dateofbirth WHERE date_of_birth IS NULL AND dateofbirth IS NOT NULL;
    ALTER TABLE public.clients DROP COLUMN dateofbirth;
  ELSIF has_camel THEN
    ALTER TABLE public.clients RENAME COLUMN dateofbirth TO date_of_birth;
  END IF;

  -- clients.anniversarydate -> anniversary_date
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='clients' AND column_name='anniversarydate')
    INTO has_camel;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='clients' AND column_name='anniversary_date')
    INTO has_snake;
  IF has_camel AND has_snake THEN
    UPDATE public.clients SET anniversary_date = anniversarydate WHERE anniversary_date IS NULL AND anniversarydate IS NOT NULL;
    ALTER TABLE public.clients DROP COLUMN anniversarydate;
  ELSIF has_camel THEN
    ALTER TABLE public.clients RENAME COLUMN anniversarydate TO anniversary_date;
  END IF;

  -- clients.createdat -> created_at
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='clients' AND column_name='createdat')
    INTO has_camel;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='clients' AND column_name='created_at')
    INTO has_snake;
  IF has_camel AND has_snake THEN
    UPDATE public.clients SET created_at = createdat WHERE created_at IS NULL AND createdat IS NOT NULL;
    ALTER TABLE public.clients DROP COLUMN createdat;
  ELSIF has_camel THEN
    ALTER TABLE public.clients RENAME COLUMN createdat TO created_at;
  END IF;

  -- clients.updatedat -> updated_at
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='clients' AND column_name='updatedat')
    INTO has_camel;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='clients' AND column_name='updated_at')
    INTO has_snake;
  IF has_camel AND has_snake THEN
    UPDATE public.clients SET updated_at = updatedat WHERE updated_at IS NULL AND updatedat IS NOT NULL;
    ALTER TABLE public.clients DROP COLUMN updatedat;
  ELSIF has_camel THEN
    ALTER TABLE public.clients RENAME COLUMN updatedat TO updated_at;
  END IF;

  -- templates.createdat -> created_at
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='templates' AND column_name='createdat')
    INTO has_camel;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='templates' AND column_name='created_at')
    INTO has_snake;
  IF has_camel AND has_snake THEN
    UPDATE public.templates SET created_at = createdat WHERE created_at IS NULL AND createdat IS NOT NULL;
    ALTER TABLE public.templates DROP COLUMN createdat;
  ELSIF has_camel THEN
    ALTER TABLE public.templates RENAME COLUMN createdat TO created_at;
  END IF;

  -- templates.updatedat -> updated_at
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='templates' AND column_name='updatedat')
    INTO has_camel;
  SELECT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema='public' AND table_name='templates' AND column_name='updated_at')
    INTO has_snake;
  IF has_camel AND has_snake THEN
    UPDATE public.templates SET updated_at = updatedat WHERE updated_at IS NULL AND updatedat IS NOT NULL;
    ALTER TABLE public.templates DROP COLUMN updatedat;
  ELSIF has_camel THEN
    ALTER TABLE public.templates RENAME COLUMN updatedat TO updated_at;
  END IF;
END $migrate$;

-- 1. Link Clerk authenticated user to a client profile
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS clerk_user_id varchar UNIQUE;

CREATE INDEX IF NOT EXISTS idx_clients_clerk_user_id
  ON public.clients (clerk_user_id);

-- 2. Lifecycle status for archive / soft-delete workflows
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS status varchar NOT NULL DEFAULT 'active';

CREATE INDEX IF NOT EXISTS idx_clients_status
  ON public.clients (status);

-- 3. Birthday marketing
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS date_of_birth date;

-- 4. Anniversary marketing (e.g. wedding / business founding date)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS anniversary_date date;

-- 5. Audit timestamps
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 6. Track which agent (Clerk user) created the client (multi-tenant ready)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS agent_user_id varchar;

CREATE INDEX IF NOT EXISTS idx_clients_agent_user_id
  ON public.clients (agent_user_id);

-- Same ownership column on the other tables for consistency
ALTER TABLE public.templates
  ADD COLUMN IF NOT EXISTS agent_user_id varchar;

ALTER TABLE public.assignments
  ADD COLUMN IF NOT EXISTS agent_user_id varchar;

ALTER TABLE public.communication_logs
  ADD COLUMN IF NOT EXISTS agent_user_id varchar;

CREATE INDEX IF NOT EXISTS idx_templates_agent_user_id
  ON public.templates (agent_user_id);
CREATE INDEX IF NOT EXISTS idx_assignments_agent_user_id
  ON public.assignments (agent_user_id);
CREATE INDEX IF NOT EXISTS idx_logs_agent_user_id
  ON public.communication_logs (agent_user_id);

-- 7. Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_clients_updated_at ON public.clients;
CREATE TRIGGER trg_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- =====================================================
-- 8. RLS policies
-- =====================================================

-- ----- CLIENTS TABLE -----
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies so this script is re-runnable
DROP POLICY IF EXISTS "Agents full access on clients" ON public.clients;
DROP POLICY IF EXISTS "Clients can read own profile" ON public.clients;
DROP POLICY IF EXISTS "Clients can update own profile" ON public.clients;

-- Agent (the business owner / SineThamsanqa team) has full access
-- to all client records they manage. The Clerk JWT's `sub` claim
-- is the user's Clerk id. We assume the agent's user_id lives in
-- the `users` table (created in onboarding).
CREATE POLICY "Agents full access on clients"
  ON public.clients
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.jwt() ->> 'sub'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.jwt() ->> 'sub'
    )
  );

-- Clients (when logged in via Clerk) can read their own profile
CREATE POLICY "Clients can read own profile"
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (clerk_user_id = auth.jwt() ->> 'sub');

-- Clients can soft-delete themselves (POPIA right to be forgotten)
CREATE POLICY "Clients can update own profile"
  ON public.clients
  FOR UPDATE
  TO authenticated
  USING (clerk_user_id = auth.jwt() ->> 'sub')
  WITH CHECK (clerk_user_id = auth.jwt() ->> 'sub');

-- ----- TEMPLATES TABLE -----
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agents full access on templates" ON public.templates;

CREATE POLICY "Agents full access on templates"
  ON public.templates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.jwt() ->> 'sub'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.jwt() ->> 'sub'
    )
  );

-- ----- ASSIGNMENTS TABLE -----
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agents full access on assignments" ON public.assignments;
DROP POLICY IF EXISTS "Clients can read own assignments" ON public.assignments;

CREATE POLICY "Agents full access on assignments"
  ON public.assignments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.jwt() ->> 'sub'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.jwt() ->> 'sub'
    )
  );

CREATE POLICY "Clients can read own assignments"
  ON public.assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = assignments.client_id
        AND c.clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

-- ----- COMMUNICATION_LOGS TABLE -----
ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agents full access on communication_logs" ON public.communication_logs;
DROP POLICY IF EXISTS "Clients can read own logs" ON public.communication_logs;

CREATE POLICY "Agents full access on communication_logs"
  ON public.communication_logs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.jwt() ->> 'sub'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.jwt() ->> 'sub'
    )
  );

CREATE POLICY "Clients can read own logs"
  ON public.communication_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = communication_logs.client_id
        AND c.clerk_user_id = auth.jwt() ->> 'sub'
    )
  );

-- =====================================================
-- 9. Helpful: ensure the users table is queryable
-- =====================================================
-- The agents app stores industry in `public.users(id, industry, ...)` and
-- writes a row on onboarding. The RLS policies above check existence in
-- this table to identify agents. If your RLS on `users` blocks reads,
-- add a permissive select policy for the same authenticated role.

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can read own user row" ON public.users;

CREATE POLICY "Authenticated can read own user row"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (id = auth.jwt() ->> 'sub');

DROP POLICY IF EXISTS "Authenticated can upsert own user row" ON public.users;

CREATE POLICY "Authenticated can upsert own user row"
  ON public.users
  FOR ALL
  TO authenticated
  USING (id = auth.jwt() ->> 'sub')
  WITH CHECK (id = auth.jwt() ->> 'sub');
