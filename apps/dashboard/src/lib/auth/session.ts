import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPainelAuthorized, PAINEL_COOKIE_NAME } from "@/lib/auth/painel";
import type { SessionIdentity } from "@/hooks/useSessionIdentity";

export type SessionUser = {
  id: string;
  email: string | null;
};

export type SessionProfile = {
  orgId: string | null;
  name: string | null;
};

// Um único cliente Supabase por requisição, compartilhado por layout e páginas.
export const getServerSupabase = cache(async () => createClient());

// getClaims valida o JWT localmente (chave assimétrica) e só vai à rede
// quando o projeto ainda usa segredo simétrico. Memorizado por requisição.
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;
  return { id: claims.sub, email: claims.email ?? null };
});

function subjectFromAccessToken(token: string | undefined): string | null {
  const payload = token?.split(".")[1];
  if (!payload) return null;
  try {
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { sub?: unknown };
    return typeof claims.sub === "string" ? claims.sub : null;
  } catch {
    return null;
  }
}

// Não espera getSessionUser: a consulta roda em paralelo com a validação.
// É seguro porque o PostgREST valida o mesmo token e a RLS de profiles só
// devolve a linha do próprio usuário.
/**
 * Id do usuário lido do token no cookie, sem ida à rede e SEM validar a
 * assinatura. Use só onde o próprio banco valida o token (consultas com RLS)
 * ou para coisas que não dão acesso a nada, como a chave da cópia local.
 */
export const getSessionSubject = cache(async (): Promise<string | null> => {
  const supabase = await getServerSupabase();
  const { data: sessionData } = await supabase.auth.getSession();
  return subjectFromAccessToken(sessionData.session?.access_token);
});

export const getSessionProfile = cache(async (): Promise<SessionProfile | null> => {
  const userId = await getSessionSubject();
  if (!userId) return null;

  const supabase = await getServerSupabase();

  const { data } = await supabase
    .from("profiles")
    .select("org_id, name")
    .eq("id", userId)
    .single();

  return {
    orgId: (data?.org_id as string | null) ?? null,
    name: (data?.name as string | null) ?? null,
  };
});

export const getSessionIdentity = cache(async (): Promise<SessionIdentity> => {
  const [user, profile] = await Promise.all([getSessionUser(), getSessionProfile()]);
  if (user?.email || profile?.name) {
    return { email: user?.email ?? null, name: profile?.name ?? null };
  }

  try {
    const cookieStore = await cookies();
    const painelCookie = cookieStore.get(PAINEL_COOKIE_NAME)?.value;
    if (await isPainelAuthorized(painelCookie)) {
      return { email: "admin@startmetric.com", name: "Evandro" };
    }
  } catch {}

  return { email: null, name: null };
});

export type DashboardSession = {
  isAuthorized: boolean;
  user: { id: string; email: string | null } | null;
  orgId: string;
  supabase: any;
  isPainel: boolean;
};

export const getDashboardSession = cache(async (): Promise<DashboardSession> => {
  const cookieStore = await cookies();
  const painelCookie = cookieStore.get(PAINEL_COOKIE_NAME)?.value;
  const isPainel = await isPainelAuthorized(painelCookie);

  let supabase: any = null;
  let user: { id: string; email: string | null } | null = null;
  let orgId: string | null = null;

  try {
    supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (data?.user) {
      user = { id: data.user.id, email: data.user.email ?? null };
      const { data: profile } = await supabase
        .from("profiles")
        .select("org_id")
        .eq("id", data.user.id)
        .single();
      orgId = profile?.org_id ?? null;
    }
  } catch {}

  if (!isPainel && !user) {
    return {
      isAuthorized: false,
      user: null,
      orgId: "",
      supabase: null,
      isPainel: false,
    };
  }

  if (user && orgId) {
    return {
      isAuthorized: true,
      user,
      orgId,
      supabase,
      isPainel: false,
    };
  }

  let adminClient: any = null;
  try {
    adminClient = createAdminClient();
  } catch {
    adminClient = supabase;
  }

  if (!orgId && adminClient) {
    try {
      const { data: orgs } = await adminClient.from("organizations").select("id, name");
      if (orgs && orgs.length > 0) {
        const evandroOrg = orgs.find((o: any) => o.name?.toLowerCase().includes("evandro"));
        orgId = evandroOrg?.id || orgs[0].id;
      }
    } catch {}
  }

  return {
    isAuthorized: true,
    user: user ?? { id: "painel-admin", email: "admin@startmetric.com" },
    orgId: orgId ?? "0b7ec073-d8cd-4ab8-8a36-fc2380c2b0b1",
    supabase: adminClient ?? supabase,
    isPainel: true,
  };
});

