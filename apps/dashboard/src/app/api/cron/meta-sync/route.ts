// app/api/cron/meta-sync/route.ts
// Job de polling para sincronizar todas as contas Meta ativas.
// Protegido por Authorization: Bearer {CRON_SECRET}.
// Configurar via Vercel Cron ou chamada manual a cada 15 min.

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { fetchCampaigns, fetchCampaignInsights, MetaApiError } from "@/lib/meta/client";
import { decryptToken } from "@/lib/meta/token";
import type { Database } from "@/lib/supabase/types";

const CRON_SECRET = process.env.CRON_SECRET;

// Supabase client com service role para contornar RLS no cron server-side
function createServiceClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } }
  );
}

function isCronAuthorized(request: Request): boolean {
  const authHeader = request.headers.get("Authorization") ?? request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : null;

  // Manual trigger with a shared secret (recommended).
  if (CRON_SECRET && token === CRON_SECRET) return true;

  // Vercel Cron calls don't let us set custom headers; accept Vercel's cron marker header.
  // Guard with VERCEL env to avoid enabling this behavior in non-Vercel environments.
  const vercelCron = request.headers.get("x-vercel-cron");
  if (process.env.VERCEL && vercelCron === "1") return true;

  return false;
}

export async function POST(request: Request) {
  // Validação de segurança do cron
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const supabase = createServiceClient();

  // Busca todas as contas ativas (sem RLS por usar service role)
  const { data: accounts, error } = await supabase
    .from("ad_accounts")
    .select("id, org_id, external_id, token_encrypted, name")
    .eq("status", "active")
    .eq("platform", "meta");

  if (error) {
    console.error("[cron/meta-sync] Erro ao buscar ad_accounts:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = { synced: 0, expired: 0, errors: 0, synced_campaigns: 0 };

  for (const account of accounts ?? []) {
    try {
      if (!account.token_encrypted) {
        console.warn(`[cron/meta-sync] Conta ${account.external_id} sem token criptografado. Skip.`);
        continue;
      }

      const rawToken = await decryptToken(account.token_encrypted, supabase);

      // ── Buscar campanhas ────────────────────────────────────
      const campaigns = await fetchCampaigns(account.external_id, rawToken);

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

        await supabase
          .from("campaigns")
          .upsert(campaignRows, { onConflict: "ad_account_id,meta_id" });
      }

      // ── Buscar insights com revenue real (últimos 30 dias) ────────
      const insights = await fetchCampaignInsights(account.external_id, rawToken, "last_30d");

      // ── Buscar IDs internos das campanhas ──────────────────────────
      const { data: campaignRows } = await supabase
        .from("campaigns")
        .select("id, meta_id")
        .eq("ad_account_id", account.id);

      const idMap = new Map((campaignRows ?? []).map((r) => [r.meta_id, r.id]));

      // ── Upsert das métricas com revenue real ────────────────────────
      const metricRows = insights
        .filter((ins) => idMap.has(ins.campaign_id))
        .map((ins) => ({
          campaign_id: idMap.get(ins.campaign_id)!,
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
        await supabase
          .from("daily_metrics")
          .upsert(metricRows, { onConflict: "campaign_id,date" });

        results.synced_campaigns += metricRows.length;
      }

      // ── Atualizar last_synced_at ───────────────────────────────
      await supabase
        .from("ad_accounts")
        .update({ last_synced_at: new Date().toISOString() })
        .eq("id", account.id);

      results.synced++;
    } catch (err) {
      if (err instanceof MetaApiError && err.isTokenExpired()) {
        await supabase
          .from("ad_accounts")
          .update({ status: "expired" })
          .eq("id", account.id);
        results.expired++;
      } else {
        console.error(`[cron/meta-sync] Erro na conta ${account.external_id}:`, err);
        results.errors++;
      }
    }
  }

  console.log(`[cron/meta-sync] Concluído: ${JSON.stringify(results)}`);
  return NextResponse.json({ ok: true, results, processedAt: new Date().toISOString() });
}

// Suporte GET para Vercel Cron (que usa GET por padrão)
export { POST as GET };
