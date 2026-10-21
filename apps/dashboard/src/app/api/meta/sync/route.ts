// app/api/meta/sync/route.ts
// Sincroniza campanhas e métricas de contas de anúncios Meta.
// Endpoint: POST /api/meta/sync — protegido por sessão Supabase.
// Se adAccountId não for fornecido, sincroniza todas as contas ativas da org.
// Sem datePreset, a janela segue last_synced_at: hoje + ontem, ou hoje + 30 dias quando a conta está atrasada.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { MetaApiError } from "@/lib/meta/client";
import { HIDDEN_ACCOUNT_STATUS } from "@/lib/meta/account-groups";
import { syncPresetsFor, type MetaFailureKind } from "@/lib/meta/sync-plan";
import {
  createTokenResolver,
  markAccountExpired,
  metaFailureKind,
  syncAccountMetrics,
} from "@/lib/meta/sync-account";

const ACCOUNT_COLUMNS = "id, org_id, external_id, token_encrypted, status, name, last_synced_at";

type SyncFailure = { adAccountId: string; code: MetaFailureKind };

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

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

  const { adAccountId, datePreset } = body;

  let accounts;
  if (adAccountId) {
    const { data: account, error } = await supabase
      .from("ad_accounts")
      .select(ACCOUNT_COLUMNS)
      .eq("external_id", adAccountId)
      .eq("org_id", profile.org_id)
      .single();

    if (error || !account) {
      return NextResponse.json({ error: "Conta não encontrada ou sem permissão" }, { status: 404 });
    }

    if (account.status === "disconnected") {
      return NextResponse.json({ error: "Conta desconectada. Reconecte para sincronizar." }, { status: 400 });
    }

    if (account.status === HIDDEN_ACCOUNT_STATUS) {
      return NextResponse.json({ error: "Conta fora do painel. Adicione-a de novo para sincronizar." }, { status: 400 });
    }

    accounts = [account];
  } else {
    const { data: accountsData, error } = await supabase
      .from("ad_accounts")
      .select(ACCOUNT_COLUMNS)
      .eq("org_id", profile.org_id)
      .eq("status", "active")
      .eq("platform", "meta")
      .not("token_encrypted", "is", null);

    if (error) {
      return NextResponse.json({ error: "Erro ao buscar contas" }, { status: 500 });
    }

    accounts = accountsData ?? [];
  }

  let syncedAccounts = 0;
  let syncedCampaigns = 0;
  const errors: string[] = [];
  const failures: SyncFailure[] = [];
  const resolveToken = createTokenResolver(supabase);

  for (const account of accounts) {
    const label = `Conta ${account.name || account.external_id}`;
    const resolved = await resolveToken(account);
    if (!resolved) {
      errors.push(`${label}: sem token da Meta`);
      failures.push({ adAccountId: account.external_id, code: "error" });
      continue;
    }

    try {
      const presets = datePreset ? [datePreset] : syncPresetsFor(account.last_synced_at, new Date());
      const counts = await syncAccountMetrics(supabase, account, resolved.token, presets);
      syncedCampaigns += counts.metrics;
      syncedAccounts++;
    } catch (err) {
      const kind = metaFailureKind(err);
      failures.push({ adAccountId: account.external_id, code: kind });
      if (kind === "expired") {
        await markAccountExpired(supabase, account, resolved.tokenEncrypted);
        errors.push(`${label}: token expirado`);
      } else if (kind === "rate_limited") {
        errors.push(`${label}: rate limit atingido`);
      } else if (err instanceof MetaApiError) {
        errors.push(`${label}: ${err.message}`);
      } else {
        console.error(`[meta/sync] Erro na conta ${account.external_id}:`, err);
        errors.push(`${label}: erro interno`);
      }
    }
  }

  return NextResponse.json({
    data: {
      synced_accounts: syncedAccounts,
      synced_campaigns: syncedCampaigns,
      errors,
      failures,
    },
  });
}
