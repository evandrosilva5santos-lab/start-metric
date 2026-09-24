import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
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
  return { email: user?.email ?? null, name: profile?.name ?? null };
});
