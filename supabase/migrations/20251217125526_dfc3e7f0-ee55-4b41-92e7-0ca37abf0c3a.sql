-- SECURITY FIX: Lock down internal_secrets (contains sensitive credentials)
--
-- Goal:
-- 1) Enable Row Level Security (RLS) so PostgREST requests from the browser cannot read/write this table.
-- 2) Revoke any accidental grants for anon/authenticated roles.
-- 3) Keep service_role access so Edge Functions (server-side) can still use it if needed.

ALTER TABLE public.internal_secrets ENABLE ROW LEVEL SECURITY;

-- Default-deny: do not allow the public API roles to access this table at all.
REVOKE ALL ON TABLE public.internal_secrets FROM anon;
REVOKE ALL ON TABLE public.internal_secrets FROM authenticated;
REVOKE ALL ON TABLE public.internal_secrets FROM public;

-- Edge Functions running with the Service Role key bypass RLS, but we still explicitly grant table privileges.
GRANT ALL ON TABLE public.internal_secrets TO service_role;

COMMENT ON TABLE public.internal_secrets IS 'Stores sensitive credentials for server-side use only. RLS enabled; anon/authenticated roles are revoked.';