-- =====================================================
-- CloudSTep: Client Profile Enhancements
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

-- 6. Trigger to keep updated_at fresh
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

-- 7. (Recommended) RLS policy so a client can read & update only their own profile
--    Re-run / adjust if your policies already exist.
--    This assumes Clerk JWTs are passed through and a clerk_user_id is the link.
--    For POPIA soft-delete, the client sets status = 'deleted_by_user'.

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients can read own profile" ON public.clients;
CREATE POLICY "Clients can read own profile"
  ON public.clients
  FOR SELECT
  TO authenticated
  USING (clerk_user_id = auth.jwt() ->> 'sub');

DROP POLICY IF EXISTS "Clients can update own profile" ON public.clients;
CREATE POLICY "Clients can update own profile"
  ON public.clients
  FOR UPDATE
  TO authenticated
  USING (clerk_user_id = auth.jwt() ->> 'sub')
  WITH CHECK (clerk_user_id = auth.jwt() ->> 'sub');

-- Note: agent (write) policies should be created separately for the agent's
-- Clerk user_id(s). If your agent uses service_role, you can keep agent
-- writes unrestricted on the server side.
