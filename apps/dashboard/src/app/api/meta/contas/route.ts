import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const STATUS_TEXT: Record<string, string> = {
  active: "Ativa",
  expired: "Token expirado",
  disconnected: "Desconectada",
};

// Contas de anúncio que a organização já ligou, com o cliente de cada uma.
export async function GET(): Promise<NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("org_id").eq("id", user.id).single();

  if (!profile?.org_id) {
    return NextResponse.json({ error: "Organização não encontrada" }, { status: 403 });
  }

  const [accountsRes, clientsRes] = await Promise.all([
    supabase
      .from("ad_accounts")
      .select("external_id, name, currency, timezone, status, client_id")
      .eq("org_id", profile.org_id)
      .eq("platform", "meta")
      .order("name", { ascending: true }),
    supabase
      .from("clients")
      .select("id, name")
      .eq("org_id", profile.org_id)
      .is("archived_at", null)
      .order("name", { ascending: true }),
  ]);

  if (accountsRes.error || clientsRes.error) {
    return NextResponse.json({ error: "Erro ao listar contas da organização" }, { status: 500 });
  }

  const contas = (accountsRes.data ?? [])
    .map((row) => ({
      id: row.external_id,
      name: row.name || row.external_id,
      currency: row.currency || "BRL",
      timezone_name: row.timezone || "America/Sao_Paulo",
      statusText: STATUS_TEXT[row.status] ?? "Desconhecido",
      isActive: row.status === "active",
      clientId: row.client_id,
    }))
    .sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return a.name.localeCompare(b.name, "pt-BR");
    });

  return NextResponse.json({
    contas,
    clientes: clientsRes.data ?? [],
    total: contas.length,
    timestamp: new Date().toISOString(),
  });
}
