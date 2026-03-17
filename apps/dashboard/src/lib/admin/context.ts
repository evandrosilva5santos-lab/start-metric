import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isPlatformAdminEmail } from "@/lib/admin/access";

export type OrgRole = "owner" | "manager" | "analyst" | "viewer" | string;

export type OrgContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  orgId: string;
  role: OrgRole;
};

type OrgContextError = {
  ok: false;
  error: NextResponse;
};

type OrgContextSuccess = {
  ok: true;
  context: OrgContext;
};

async function buildOrgContext(): Promise<OrgContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("org_id, role, name")
    .eq("id", user.id)
    .single();

  if (profileError || !profile?.org_id) {
    return null;
  }

  return {
    supabase,
    userId: user.id,
    userEmail: user.email ?? null,
    userName: (profile.name as string | null) ?? null,
    orgId: profile.org_id as string,
    role: (profile.role as OrgRole) ?? "viewer",
  };
}

export async function requireAuthenticatedOrgContext(): Promise<
  OrgContextError | OrgContextSuccess
> {
  const context = await buildOrgContext();

  if (!context) {
    return {
      ok: false,
      error: NextResponse.json({ error: "Não autenticado" }, { status: 401 }),
    };
  }

  return { ok: true, context };
}

export async function requireAdminOrgContext(): Promise<
  OrgContextError | OrgContextSuccess
> {
  const auth = await requireAuthenticatedOrgContext();
  if (!auth.ok) {
    return auth;
  }

  if (!isPlatformAdminEmail(auth.context.userEmail)) {
    return {
      ok: false,
      error: NextResponse.json(
        {
          error:
            "Acesso restrito ao backoffice administrativo. Sua conta de cliente não possui permissão.",
        },
        { status: 403 },
      ),
    };
  }

  return auth;
}
