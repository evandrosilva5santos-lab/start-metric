import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAuthorizedDashboard } from "@/lib/auth/standalone";
import { syncAccountsAndTokenInBackground } from "@/lib/meta/supabase-sync";

export const dynamic = "force-dynamic";

let memoryCache: { timestamp: number; data: { contas: unknown[]; total: number; timestamp: string } | null } = {
  timestamp: 0,
  data: null,
};
const CACHE_TTL_MS = 90 * 1000;

// Lista as contas de anúncio vinculadas à organização ou ao token da Meta
export async function GET(req: NextRequest): Promise<NextResponse> {
  const isDashboardAuth = isAuthorizedDashboard(req);
  const fallbackToken = process.env.META_TOKEN || process.env.META_SYSTEM_TOKEN || process.env.META_USER_TOKEN;

  if (isDashboardAuth) {
    if (!fallbackToken) {
      return NextResponse.json(
        { error: "Variável META_TOKEN não configurada no servidor." },
        { status: 500 }
      );
    }

    const forceFresh = req.nextUrl.searchParams.get("fresh") === "true";
    const now = Date.now();
    if (!forceFresh && memoryCache.data && now - memoryCache.timestamp < CACHE_TTL_MS) {
      return NextResponse.json(memoryCache.data);
    }

    try {
      const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || "v21.0";
      const res = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/me/adaccounts?fields=id,name,account_status,currency,timezone_name,amount_spent&limit=100&access_token=${encodeURIComponent(fallbackToken)}`,
        { signal: AbortSignal.timeout(10_000) }
      );
      const data = await res.json();
      if (data?.error) {
        if (memoryCache.data) {
          return NextResponse.json({ ...memoryCache.data, rateLimitHit: true });
        }
        return NextResponse.json({ error: `Erro Meta: ${data.error.message}` }, { status: 400 });
      }

      const rawList = Array.isArray(data?.data) ? data.data : [];
      const accounts = rawList.map((acc: { id: string; name?: string; account_status?: number; currency?: string; timezone_name?: string }) => {
        const isActive = acc.account_status === 1;
        const statusText =
          acc.account_status === 1
            ? "Ativa"
            : acc.account_status === 2
              ? "Desativada"
              : "Desconhecido";
        return {
          id: acc.id,
          name: acc.name || acc.id,
          currency: acc.currency || "BRL",
          timezone_name: acc.timezone_name || "America/Sao_Paulo",
          statusText,
          isActive,
        };
      });

      accounts.sort((a: { isActive: boolean; name: string }, b: { isActive: boolean; name: string }) => {
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        return a.name.localeCompare(b.name);
      });

      const responsePayload = {
        contas: accounts,
        total: accounts.length,
        timestamp: new Date().toISOString(),
      };

      memoryCache = { timestamp: now, data: responsePayload };
      syncAccountsAndTokenInBackground(accounts, fallbackToken);

      return NextResponse.json(responsePayload);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: `Falha ao conectar na Meta: ${message}` }, { status: 500 });
    }
  }

  // Fluxo autenticado por sessão Supabase (SaaS)
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id) {
    return NextResponse.json({ error: "Organização não encontrada" }, { status: 403 });
  }

  const { data: rows, error } = await supabase
    .from("ad_accounts")
    .select("id, external_id, name, currency, timezone, status")
    .eq("platform", "meta")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "Erro ao listar contas da organização" }, { status: 500 });
  }

  let accounts = (rows ?? []).map((row) => {
    const isActive = row.status === "active";
    const statusText =
      row.status === "active"
        ? "Ativa"
        : row.status === "expired"
          ? "Token expirado"
          : row.status === "disconnected"
            ? "Desconectada"
            : "Desconhecido";

    return {
      id: row.external_id,
      name: row.name || row.external_id,
      currency: row.currency || "BRL",
      timezone_name: row.timezone || "America/Sao_Paulo",
      statusText,
      isActive,
    };
  });

  // Fallback: se não houver contas cadastradas na tabela ad_accounts, busca direto da Graph API
  if (accounts.length === 0 && fallbackToken) {
    try {
      const GRAPH_VERSION = process.env.META_GRAPH_API_VERSION || "v21.0";
      const res = await fetch(
        `https://graph.facebook.com/${GRAPH_VERSION}/me/adaccounts?fields=id,name,account_status,currency,timezone_name,amount_spent&limit=100&access_token=${encodeURIComponent(fallbackToken)}`,
        { signal: AbortSignal.timeout(10_000) }
      );
      const data = await res.json();
      if (Array.isArray(data?.data)) {
        accounts = data.data.map((acc: { id: string; name?: string; account_status?: number; currency?: string; timezone_name?: string }) => {
          const isActive = acc.account_status === 1;
          const statusText =
            acc.account_status === 1
              ? "Ativa"
              : acc.account_status === 2
                ? "Desativada"
                : "Desconhecido";
          return {
            id: acc.id,
            name: acc.name || acc.id,
            currency: acc.currency || "BRL",
            timezone_name: acc.timezone_name || "America/Sao_Paulo",
            statusText,
            isActive,
          };
        });

        syncAccountsAndTokenInBackground(accounts, fallbackToken);
      }
    } catch (graphErr) {
      console.warn("[meta/contas] Erro ao buscar contas de fallback na Graph API:", graphErr);
    }
  }

  accounts.sort((a, b) => {
    if (a.isActive && !b.isActive) return -1;
    if (!a.isActive && b.isActive) return 1;
    return a.name.localeCompare(b.name);
  });

  return NextResponse.json({
    contas: accounts,
    total: accounts.length,
    timestamp: new Date().toISOString(),
  });
}
