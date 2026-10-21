import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type AlertsAuth = {
  supabase: SupabaseClient;
  userId: string;
  orgId: string;
};

export function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

// Cliente sem o tipo gerado: alerts.metadata e os embeds não estão em Database.
export async function requireAlertsAuth(): Promise<AlertsAuth | NextResponse> {
  const typed = await createClient();
  const supabase = typed as unknown as SupabaseClient;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return jsonError("Não autenticado", 401);

  const { data: profile, error } = await supabase.from("profiles").select("org_id").eq("id", user.id).maybeSingle();
  if (error) return jsonError("Não deu para carregar o seu perfil.", 500);
  const orgId = (profile?.org_id as string | null | undefined) ?? null;
  if (!orgId) return jsonError("Sua conta ainda não está ligada a uma organização.", 403);

  return { supabase, userId: user.id, orgId };
}

export async function readJson(request: Request): Promise<{ ok: true; body: unknown } | { ok: false }> {
  try {
    return { ok: true, body: await request.json() };
  } catch {
    return { ok: false };
  }
}
