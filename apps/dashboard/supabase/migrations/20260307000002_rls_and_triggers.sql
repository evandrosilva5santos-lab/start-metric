-- =============================================================================
-- Migration: 20260307000002_rls_and_triggers.sql
-- Description: RLS policies and auth/profile triggers
-- PostgreSQL 15 / Supabase compatible
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) ENABLE RLS ON CORE TABLES
-- -----------------------------------------------------------------------------
ALTER TABLE public.sm_auth_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sm_meta_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sm_meta_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sm_perf_daily_metrics ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 2) POLICIES FOR sm_meta_tokens
--    - SELECT: user_id = auth.uid()
--    - INSERT: user_id = auth.uid()
--    - DELETE: user_id = auth.uid()
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS sm_meta_tokens_select_own ON public.sm_meta_tokens;
CREATE POLICY sm_meta_tokens_select_own
ON public.sm_meta_tokens
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS sm_meta_tokens_insert_own ON public.sm_meta_tokens;
CREATE POLICY sm_meta_tokens_insert_own
ON public.sm_meta_tokens
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS sm_meta_tokens_delete_own ON public.sm_meta_tokens;
CREATE POLICY sm_meta_tokens_delete_own
ON public.sm_meta_tokens
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- 3) POLICIES FOR sm_auth_profiles
--    - SELECT/UPDATE: id = auth.uid()
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS sm_auth_profiles_select_own ON public.sm_auth_profiles;
CREATE POLICY sm_auth_profiles_select_own
ON public.sm_auth_profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

DROP POLICY IF EXISTS sm_auth_profiles_update_own ON public.sm_auth_profiles;
CREATE POLICY sm_auth_profiles_update_own
ON public.sm_auth_profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- -----------------------------------------------------------------------------
-- 4) TRIGGER TO AUTO-CREATE sm_auth_profiles ON auth.users INSERT
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_sm_handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.sm_auth_profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sm_auth_user_created_profile ON auth.users;
CREATE TRIGGER trg_sm_auth_user_created_profile
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.fn_sm_handle_new_auth_user();

-- -----------------------------------------------------------------------------
-- 5) updated_at TRIGGER FUNCTION FOR sm_auth_profiles
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_sm_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sm_auth_profiles_set_updated_at ON public.sm_auth_profiles;
CREATE TRIGGER trg_sm_auth_profiles_set_updated_at
BEFORE UPDATE ON public.sm_auth_profiles
FOR EACH ROW
EXECUTE FUNCTION public.fn_sm_set_updated_at();
