-- Fase 3: Auth + Multi-tenant base (ADR-005)

CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    plan TEXT NOT NULL DEFAULT 'free',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
    role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'manager', 'analyst', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_org_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT org_id
    FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
    SELECT role
    FROM public.profiles
    WHERE id = auth.uid()
    LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.current_org_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;

DROP POLICY IF EXISTS organizations_select_by_membership ON public.organizations;
CREATE POLICY organizations_select_by_membership
ON public.organizations
FOR SELECT
TO authenticated
USING (id = public.current_org_id());

DROP POLICY IF EXISTS organizations_insert_authenticated ON public.organizations;
CREATE POLICY organizations_insert_authenticated
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS organizations_update_owner_only ON public.organizations;
CREATE POLICY organizations_update_owner_only
ON public.organizations
FOR UPDATE
TO authenticated
USING (
    id = public.current_org_id()
    AND public.current_user_role() = 'owner'
)
WITH CHECK (
    id = public.current_org_id()
    AND public.current_user_role() = 'owner'
);

DROP POLICY IF EXISTS profiles_select_same_org ON public.profiles;
CREATE POLICY profiles_select_same_org
ON public.profiles
FOR SELECT
TO authenticated
USING (org_id = public.current_org_id());

DROP POLICY IF EXISTS profiles_insert_self ON public.profiles;
CREATE POLICY profiles_insert_self
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS profiles_update_self_or_manager ON public.profiles;
CREATE POLICY profiles_update_self_or_manager
ON public.profiles
FOR UPDATE
TO authenticated
USING (
    id = auth.uid()
    OR (
        org_id = public.current_org_id()
        AND public.current_user_role() IN ('owner', 'manager')
    )
)
WITH CHECK (
    id = auth.uid()
    OR (
        org_id = public.current_org_id()
        AND public.current_user_role() IN ('owner', 'manager')
    )
);

CREATE INDEX IF NOT EXISTS idx_profiles_org_id ON public.profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
