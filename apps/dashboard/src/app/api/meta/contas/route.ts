import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isPainelAuthorized, PAINEL_COOKIE_NAME } from "@/lib/auth/painel";

export const dynamic = "force-dynamic";

const STATUS_TEXT: Record<string, string> = {
  active: "Ativa",
  expired: "Token expirado",
  disconnected: "Desconectada",
};

type GraphAccountItem = {
  id: string;
  name?: string;
  currency?: string;
  timezone_name?: string;
  account_status?: number;
};

// Contas de anúncio disponíveis via META_TOKEN ou associadas no Supabase
export async function GET(): Promise<NextResponse> {
  const cookieStore = await cookies();
  const painelCookie = cookieStore.get(PAINEL_COOKIE_NAME)?.value;
  const isPainel = await isPainelAuthorized(painelCookie);

  let user = null;
  let supabase = null;

  try {
    supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch {
    // Supabase opcional se autenticado por senha do painel
  }

  if (!isPainel && !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const envToken =
    process.env.META_TOKEN ||
    process.env.META_SYSTEM_TOKEN ||
    process.env.META_USER_TOKEN;

  // 1. Se META_TOKEN está presente nas envs, buscar diretamente na Graph API
  if (envToken) {
    try {
      const graphVersion = process.env.META_GRAPH_API_VERSION || "v21.0";
      const graphRes = await fetch(
        `https://graph.facebook.com/${graphVersion}/me/adaccounts?fields=id,name,currency,timezone_name,account_status&limit=100&access_token=${encodeURIComponent(envToken)}`,
        { next: { revalidate: 60 } },
      );
      const graphData = await graphRes.json();

      if (graphData?.data && Array.isArray(graphData.data)) {
        const contas = (graphData.data as GraphAccountItem[])
          .map((acc) => ({
            id: acc.id.startsWith("act_") ? acc.id : `act_${acc.id}`,
            name: acc.name || acc.id,
            currency: acc.currency || "BRL",
            timezone_name: acc.timezone_name || "America/Sao_Paulo",
            statusText: acc.account_status === 1 ? "Ativa" : "Desativada",
            isActive: acc.account_status === 1,
            clientId: null,
          }))
          .sort((a, b) => {
            if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
            return a.name.localeCompare(b.name, "pt-BR");
          });

        return NextResponse.json({
          contas,
          clientes: [],
          total: contas.length,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error("[meta/contas] Erro ao consultar Graph API via META_TOKEN:", err);
    }
  }

  // 2. Fallback para banco Supabase caso não haja META_TOKEN direto ou falhe
  if (supabase && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("org_id")
      .eq("id", user.id)
      .single();

    if (profile?.org_id) {
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
  }

  return NextResponse.json(
    { error: "Nenhuma conta de anúncios encontrada ou configurada." },
    { status: 404 },
  );
}
