-- =====================================================
-- CloudSTep: Client Profile Enhancements + Agent RLS
-- Run these statements against your Supabase project
-- =====================================================

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
