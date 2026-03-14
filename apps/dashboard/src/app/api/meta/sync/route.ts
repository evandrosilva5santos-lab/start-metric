// app/api/meta/sync/route.ts
// Sincroniza campanhas e métricas de uma conta de anúncios Meta.
// Endpoint: POST /api/meta/sync — protegido por sessão Supabase.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchCampaigns, fetchInsights, MetaApiError } from "@/lib/meta/client";
import { decryptToken } from "@/lib/meta/token";

// Range padrão: últimos 30 dias
function getDefaultDateRange() {
  const until = new Date();
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  return { since: fmt(since), until: fmt(until) };
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  let body: { adAccountId?: string; dateRange?: { since: string; until: string } };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const { adAccountId } = body;
  if (!adAccountId) {
    return NextResponse.json({ error: "adAccountId obrigatório" }, { status: 400 });
  }

  const dateRange = body.dateRange ?? getDefaultDateRange();

  // ── Buscar conta e validar ownership via RLS ────────────────
  const { data: account, error: accountError } = await supabase
    .from("ad_accounts")
    .select("id, org_id, token_encrypted, status, external_id")
    .eq("external_id", adAccountId)
    .single();

  if (accountError || !account) {
    return NextResponse.json({ error: "Conta não encontrada ou sem permissão" }, { status: 404 });
  }

  if (account.status === "disconnected") {
    return NextResponse.json({ error: "Conta desconectada. Reconecte para sincronizar." }, { status: 400 });
  }

  if (!account.token_encrypted) {
    return NextResponse.json(
      { error: "Conta sem token válido. Reconecte para sincronizar." },
      { status: 400 },
    );
  }

  try {
    // ── Descriptografar token ────────────────────────────────
    const token = await decryptToken(account.token_encrypted);

    // ── Buscar campanhas via Graph API ────────────────────────
    const campaigns = await fetchCampaigns(adAccountId, token);

    // ── Upsert das campanhas ──────────────────────────────────
    if (campaigns.length > 0) {
      const campaignRows = campaigns.map((c) => ({
        ad_account_id: account.id,
        org_id: account.org_id,
        meta_id: c.id,
        name: c.name,
        status: c.status,
        objective: c.objective,
        daily_budget: c.daily_budget ? parseFloat(c.daily_budget) / 100 : null,
      }));

      const { error: campaignError } = await supabase
        .from("campaigns")
        .upsert(campaignRows, { onConflict: "ad_account_id,meta_id" });

      if (campaignError) {
        console.error("[meta/sync] Erro upsert campaigns:", campaignError);
      }
    }

    // ── Buscar insights ──────────────────────────────────────
    const insights = await fetchInsights(adAccountId, token, dateRange);

    // ── Buscar IDs internos das campanhas para FK ─────────────
    const { data: campaignRows } = await supabase
      .from("campaigns")
      .select("id, meta_id")
      .eq("ad_account_id", account.id);

    const campaignIdMap = new Map<string, string>(
      (campaignRows ?? []).map((r) => [r.meta_id, r.id])
    );

    // ── Upsert das métricas ───────────────────────────────────
    const metricErrors: string[] = [];
    if (insights.length > 0) {
      const metricRows = insights
        .filter((ins) => campaignIdMap.has(ins.campaign_id))
        .map((ins) => ({
          campaign_id: campaignIdMap.get(ins.campaign_id)!,
          org_id: account.org_id,
          date: ins.date_start,
          spend: parseFloat(ins.spend || "0"),
          impressions: parseInt(ins.impressions || "0", 10),
          clicks: parseInt(ins.clicks || "0", 10),
          conversions: ins.conversions ?? 0,
          revenue_attributed: ins.revenue ?? 0,
        }));

      if (metricRows.length > 0) {
        const { error: metricsError } = await supabase
          .from("daily_metrics")
          .upsert(metricRows, { onConflict: "campaign_id,date" });

        if (metricsError) {
          metricErrors.push(metricsError.message);
        }
      }
    }

    return NextResponse.json({
      synced: {
        campaigns: campaigns.length,
        metrics: insights.length,
      },
      errors: metricErrors,
    });
  } catch (err) {
    if (err instanceof MetaApiError) {
      // Token expirado → atualizar status da conta
      if (err.isTokenExpired()) {
        await supabase
          .from("ad_accounts")
          .update({ status: "expired" })
          .eq("id", account.id);

        return NextResponse.json(
          { error: "Token Meta expirado. Reconecte a conta.", code: "TOKEN_EXPIRED" },
          { status: 401 }
        );
      }

      if (err.isRateLimited()) {
        return NextResponse.json(
          { error: "Rate limit Meta atingido. Tente novamente em alguns minutos.", code: "RATE_LIMITED" },
          { status: 429 }
        );
      }

      return NextResponse.json({ error: err.message, code: err.code }, { status: 502 });
    }

    console.error("[meta/sync] Erro inesperado:", err);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
