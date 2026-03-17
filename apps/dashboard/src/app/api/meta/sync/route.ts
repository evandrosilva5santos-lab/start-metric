// app/api/meta/sync/route.ts
// Sincroniza campanhas e métricas de contas de anúncios Meta.
// Endpoint: POST /api/meta/sync — protegido por sessão Supabase.
// Se adAccountId não for fornecido, sincroniza todas as contas ativas da org.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchCampaigns, fetchCampaignInsights, MetaApiError } from "@/lib/meta/client";
import { decryptToken } from "@/lib/meta/token";

// Date preset padrão: últimos 30 dias
const DEFAULT_DATE_PRESET = "last_30d";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  // Buscar org_id do usuário
  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id) {
    return NextResponse.json({ error: "Perfil sem organização" }, { status: 400 });
  }

  let body: { adAccountId?: string; datePreset?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const { adAccountId, datePreset = DEFAULT_DATE_PRESET } = body;

  // Buscar contas para sincronizar
  let accounts;
  if (adAccountId) {
    // Sync de uma conta específica
    const { data: account, error } = await supabase
      .from("ad_accounts")
      .select("id, org_id, external_id, token_encrypted, status, name")
      .eq("external_id", adAccountId)
      .eq("org_id", profile.org_id)
      .single();

    if (error || !account) {
      return NextResponse.json({ error: "Conta não encontrada ou sem permissão" }, { status: 404 });
    }

    if (account.status === "disconnected") {
      return NextResponse.json({ error: "Conta desconectada. Reconecte para sincronizar." }, { status: 400 });
    }

    accounts = [account];
  } else {
    // Sync de todas as contas ativas da org
    const { data: accountsData, error } = await supabase
      .from("ad_accounts")
      .select("id, org_id, external_id, token_encrypted, status, name")
      .eq("org_id", profile.org_id)
      .eq("status", "active")
      .eq("platform", "meta")
      .not("token_encrypted", "is", null);

    if (error) {
      return NextResponse.json({ error: "Erro ao buscar contas" }, { status: 500 });
    }

    accounts = accountsData ?? [];
  }

  // Resultados do sync
  let syncedAccounts = 0;
  let syncedCampaigns = 0;
  const errors: string[] = [];

  // Processar cada conta
  for (const account of accounts) {
    try {
      if (!account.token_encrypted) {
        errors.push(`Conta ${account.name || account.external_id}: sem token criptografado`);
        continue;
      }

      // ── Descriptografar token ────────────────────────────────
      const token = await decryptToken(account.token_encrypted);

      // ── Buscar campanhas via Graph API ────────────────────────
      const campaigns = await fetchCampaigns(account.external_id, token);

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

      // ── Buscar insights completos com revenue ──────────────────────
      const insights = await fetchCampaignInsights(account.external_id, token, datePreset);

      // ── Buscar IDs internos das campanhas para FK ─────────────
      const { data: campaignRows } = await supabase
        .from("campaigns")
        .select("id, meta_id")
        .eq("ad_account_id", account.id);

      const campaignIdMap = new Map<string, string>(
        (campaignRows ?? []).map((r) => [r.meta_id, r.id])
      );

      // ── Upsert das métricas com revenue real ───────────────────
      if (insights.length > 0) {
        const metricRows = insights
          .filter((ins) => campaignIdMap.has(ins.campaign_id))
          .map((ins) => ({
            campaign_id: campaignIdMap.get(ins.campaign_id)!,
            org_id: account.org_id,
            date: ins.date,
            spend: ins.spend,
            impressions: ins.impressions,
            clicks: ins.clicks,
            conversions: ins.conversions,
            revenue_attributed: ins.revenue_attributed,
            roas: ins.roas,
            cpa: ins.cpa,
          }));

        if (metricRows.length > 0) {
          const { error: metricsError } = await supabase
            .from("daily_metrics")
            .upsert(metricRows, { onConflict: "campaign_id,date" });

          if (metricsError) {
            console.error("[meta/sync] Erro upsert metrics:", metricsError);
          }
        }

        syncedCampaigns += metricRows.length;
      }

      // ── Atualizar last_synced_at ─────────────────────────────
      await supabase
        .from("ad_accounts")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", account.id);

      syncedAccounts++;
    } catch (err) {
      if (err instanceof MetaApiError) {
        // Token expirado → atualizar status da conta
        if (err.isTokenExpired()) {
          await supabase
            .from("ad_accounts")
            .update({ status: "expired" })
            .eq("id", account.id);

          errors.push(`Conta ${account.name || account.external_id}: token expirado`);
          continue;
        }

        if (err.isRateLimited()) {
          errors.push(`Conta ${account.name || account.external_id}: rate limit atingido`);
          continue;
        }

        errors.push(`Conta ${account.name || account.external_id}: ${err.message}`);
      } else {
        console.error(`[meta/sync] Erro na conta ${account.external_id}:`, err);
        errors.push(`Conta ${account.name || account.external_id}: erro interno`);
      }
    }
  }

  return NextResponse.json({
    data: {
      synced_accounts: syncedAccounts,
      synced_campaigns: syncedCampaigns,
      errors,
    },
  });
}
