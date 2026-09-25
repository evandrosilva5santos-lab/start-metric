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

  const orgId = profile.org_id;
  const accountsQuery = (columns: string) =>
    supabase.from("ad_accounts").select(columns).eq("org_id", orgId).eq("platform", "meta").order("name", { ascending: true });

  const [firstAccountsRes, clientsRes] = await Promise.all([
    accountsQuery("external_id, name, currency, timezone, status, client_id"),
    supabase.from("clients").select("id, name").eq("org_id", orgId).is("archived_at", null).order("name", { ascending: true }),
  ]);

  // Banco sem a migração de clientes (coluna client_id): lista as contas mesmo assim.
  let accountsRes = firstAccountsRes;
  if (accountsRes.error?.code === "42703") {
    console.warn("[meta/contas] ad_accounts.client_id não existe; aplique a migração 20260318000000_clients_full.sql");
    accountsRes = await accountsQuery("external_id, name, currency, timezone, status");
  }

  if (accountsRes.error) {
    console.error("[meta/contas] Erro ao listar ad_accounts:", accountsRes.error.code, accountsRes.error.message);
    return NextResponse.json(
      { error: `Erro ao listar contas da organização (${accountsRes.error.code ?? "sem código"})` },
      { status: 500 },
    );
  }
  if (clientsRes.error) {
    console.warn("[meta/contas] Clientes indisponíveis, seguindo sem eles:", clientsRes.error.code, clientsRes.error.message);
  }

  type AccountRow = {
    external_id: string;
    name: string | null;
    currency: string | null;
    timezone: string | null;
    status: string;
    client_id?: string | null;
  };

  const contas = ((accountsRes.data ?? []) as unknown as AccountRow[])
    .map((row) => ({
      id: row.external_id,
      name: row.name || row.external_id,
      currency: row.currency || "BRL",
      timezone_name: row.timezone || "America/Sao_Paulo",
      statusText: STATUS_TEXT[row.status] ?? "Desconhecido",
      isActive: row.status === "active",
      clientId: row.client_id ?? null,
    }))
    .sort((a, b) => {
      if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
      return a.name.localeCompare(b.name, "pt-BR");
    });

  return NextResponse.json({
    contas,
    clientes: clientsRes.error ? [] : (clientsRes.data ?? []),
    total: contas.length,
    timestamp: new Date().toISOString(),
  });
}
