// Server-side ONLY. Conexão, descoberta de contas e sincronização do Google Ads por org.
// Toda consulta e escrita filtra org_id explicitamente (o painel usa service role).

import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptToken, encryptToken } from "@/lib/meta/token";
import {
  GoogleAdsApiError,
  getAccessToken,
  listAccessibleCustomers,
  readGoogleAdsConfig,
  searchAll,
  type GoogleAdsConfig,
  type GoogleCredential,
} from "./client";
import {
  accountsQuery,
  campaignsQuery,
  dailyMetricsQuery,
  formatCustomerId,
  mapCampaign,
  mapCustomerClient,
  mapDailyMetric,
  type GoogleAdsAccount,
} from "./gaql";

// As tabelas do Google ainda não estão nos tipos gerados do Supabase.
type Db = SupabaseClient;

export type GoogleConnection = {
  id: string;
  org_id: string;
  mode: "service_account" | "oauth";
  login_customer_id: string | null;
  refresh_token_encrypted: string | null;
  google_email: string | null;
  status: string;
  last_error_code: string | null;
  last_error: string | null;
  connected_at: string;
};

export type GoogleAccountRow = {
  id: string;
  org_id: string;
  external_id: string;
  name: string | null;
  currency: string | null;
  timezone: string | null;
  status: string;
  client_id: string | null;
  last_synced_at: string | null;
};

const DEFAULT_TIMEZONE = "America/Sao_Paulo";
const FIRST_SYNC_DAYS = 30;
const INCREMENTAL_DAYS = 3;
const UPSERT_CHUNK = 500;

export function googleErrorMessage(err: unknown, serviceAccountEmail: string | null = null): string {
  if (!(err instanceof GoogleAdsApiError)) return err instanceof Error ? err.message : "Erro inesperado no Google Ads.";
  switch (err.kind) {
    case "developer_token_not_approved":
      return "O developer token só está aprovado para contas de teste. No Google Ads do MCC, vá em Ferramentas → Centro de API e solicite o acesso Básico.";
    case "no_access":
      return serviceAccountEmail
        ? `Sem acesso a esta conta. Adicione ${serviceAccountEmail} como usuário no MCC (Administrador → Acesso e segurança).`
        : "Sem acesso a esta conta com o login do Google conectado.";
    case "auth":
      return `A credencial do Google foi recusada (${err.message}). Confira a chave da conta de serviço ou reconecte o Google.`;
    case "quota":
      return "O Google Ads limitou as consultas por alguns minutos. Tente de novo em instantes.";
    case "config":
      return err.message;
    default:
      return `Erro do Google Ads: ${err.message}`;
  }
}

export async function getConnection(db: Db, orgId: string): Promise<GoogleConnection | null> {
  const { data, error } = await db
    .from("google_ads_connections")
    .select("id, org_id, mode, login_customer_id, refresh_token_encrypted, google_email, status, last_error_code, last_error, connected_at")
    .eq("org_id", orgId);
  if (error) throw new Error(`conexão Google: ${error.message}`);
  const rows = (data ?? []) as GoogleConnection[];
  return rows.find((r) => r.mode === "oauth") ?? rows.find((r) => r.mode === "service_account") ?? null;
}

type ApiContext = { connection: GoogleConnection; config: GoogleAdsConfig; accessToken: string; developerToken: string };

async function credentialFor(db: Db, connection: GoogleConnection, config: GoogleAdsConfig): Promise<GoogleCredential> {
  if (connection.mode === "service_account") {
    if (!config.serviceAccount) {
      throw new GoogleAdsApiError(config.serviceAccountError ?? "Falta GOOGLE_ADS_SERVICE_ACCOUNT_JSON na Vercel.", "config");
    }
    return { mode: "service_account", serviceAccount: config.serviceAccount };
  }
  if (!connection.refresh_token_encrypted) throw new GoogleAdsApiError("Conexão Google sem token. Conecte de novo.", "auth");
  return { mode: "oauth", refreshToken: await decryptToken(connection.refresh_token_encrypted, db as never) };
}

async function apiContext(db: Db, orgId: string): Promise<ApiContext> {
  const config = readGoogleAdsConfig();
  if (!config.developerToken) throw new GoogleAdsApiError("Falta GOOGLE_ADS_DEVELOPER_TOKEN na Vercel.", "config");
  const connection = await getConnection(db, orgId);
  if (!connection) throw new GoogleAdsApiError("Google Ads ainda não conectado nesta organização.", "config");
  const accessToken = await getAccessToken(await credentialFor(db, connection, config), config);
  return { connection, config, accessToken, developerToken: config.developerToken };
}

async function recordConnectionResult(db: Db, connection: GoogleConnection, err: unknown | null): Promise<void> {
  const kind = err instanceof GoogleAdsApiError ? err.kind : err ? "error" : null;
  await db
    .from("google_ads_connections")
    .update({
      status: kind === "auth" ? "expired" : kind ? "error" : "active",
      last_error_code: kind,
      last_error: err ? googleErrorMessage(err).slice(0, 500) : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", connection.id)
    .eq("org_id", connection.org_id);
}

export async function connectServiceAccount(db: Db, orgId: string): Promise<GoogleConnection> {
  const config = readGoogleAdsConfig();
  if (!config.serviceAccount) {
    throw new GoogleAdsApiError(config.serviceAccountError ?? "Falta GOOGLE_ADS_SERVICE_ACCOUNT_JSON na Vercel.", "config");
  }
  const { data, error } = await db
    .from("google_ads_connections")
    .upsert(
      { org_id: orgId, mode: "service_account", login_customer_id: config.loginCustomerId, status: "active", updated_at: new Date().toISOString() },
      { onConflict: "org_id,mode" },
    )
    .select("id, org_id, mode, login_customer_id, refresh_token_encrypted, google_email, status, last_error_code, last_error, connected_at")
    .single();
  if (error) throw new Error(`salvar conexão: ${error.message}`);
  return data as GoogleConnection;
}

export async function saveOAuthConnection(db: Db, orgId: string, refreshToken: string, email: string | null): Promise<void> {
  const config = readGoogleAdsConfig();
  const encrypted = await encryptToken(refreshToken, db as never);
  const { error } = await db.from("google_ads_connections").upsert(
    {
      org_id: orgId,
      mode: "oauth",
      login_customer_id: config.loginCustomerId,
      refresh_token_encrypted: encrypted,
      google_email: email,
      status: "active",
      last_error_code: null,
      last_error: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "org_id,mode" },
  );
  if (error) throw new Error(`salvar conexão: ${error.message}`);
}

async function fetchAccounts(ctx: ApiContext): Promise<GoogleAdsAccount[]> {
  const options = { accessToken: ctx.accessToken, developerToken: ctx.developerToken };
  const roots = ctx.connection.login_customer_id ? [ctx.connection.login_customer_id] : await listAccessibleCustomers(options);
  const found = new Map<string, GoogleAdsAccount>();
  for (const root of roots) {
    const rows = await searchAll(root, accountsQuery(), { ...options, loginCustomerId: root });
    for (const account of rows.map(mapCustomerClient)) {
      if (!account.manager && account.customerId) found.set(account.customerId, account);
    }
  }
  return [...found.values()];
}

export async function discoverAccounts(db: Db, orgId: string): Promise<{ found: number; created: number }> {
  const ctx = await apiContext(db, orgId);
  try {
    const accounts = await fetchAccounts(ctx);
    const { data: existing, error } = await db.from("ad_accounts").select("id, external_id").eq("org_id", orgId).eq("platform", "google");
    if (error) throw new Error(`contas: ${error.message}`);
    const known = new Map(((existing ?? []) as Array<{ id: string; external_id: string }>).map((r) => [r.external_id, r.id]));

    const fresh = accounts.filter((a) => !known.has(a.customerId));
    if (fresh.length > 0) {
      const { error: insertError } = await db.from("ad_accounts").insert(
        fresh.map((a) => ({
          org_id: orgId,
          platform: "google",
          external_id: a.customerId,
          name: a.name,
          currency: a.currency ?? "BRL",
          timezone: a.timeZone ?? DEFAULT_TIMEZONE,
          status: a.status === "ENABLED" ? "active" : "hidden",
          connected_at: new Date().toISOString(),
        })),
      );
      if (insertError) throw new Error(`salvar contas: ${insertError.message}`);
    }
    for (const a of accounts.filter((acc) => known.has(acc.customerId))) {
      await db
        .from("ad_accounts")
        .update({ name: a.name, currency: a.currency ?? "BRL", timezone: a.timeZone ?? DEFAULT_TIMEZONE })
        .eq("org_id", orgId)
        .eq("id", known.get(a.customerId)!);
    }
    await recordConnectionResult(db, ctx.connection, null);
    return { found: accounts.length, created: fresh.length };
  } catch (err) {
    await recordConnectionResult(db, ctx.connection, err);
    throw err;
  }
}

function localToday(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

async function upsertChunks(db: Db, table: string, rows: Record<string, unknown>[], onConflict: string): Promise<void> {
  for (let i = 0; i < rows.length; i += UPSERT_CHUNK) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + UPSERT_CHUNK), { onConflict });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

async function syncAccount(db: Db, ctx: ApiContext, account: GoogleAccountRow, days: number): Promise<{ campaigns: number; metricRows: number }> {
  const options = {
    accessToken: ctx.accessToken,
    developerToken: ctx.developerToken,
    loginCustomerId: ctx.connection.login_customer_id ?? account.external_id,
  };
  const today = localToday(account.timezone || DEFAULT_TIMEZONE);
  const from = shiftDay(today, -(days - 1));
  const now = new Date().toISOString();

  const campaigns = (await searchAll(account.external_id, campaignsQuery(), options)).map(mapCampaign).filter((c) => c.campaignId);
  await upsertChunks(
    db,
    "google_ads_campaigns",
    campaigns.map((c) => ({
      org_id: account.org_id,
      ad_account_id: account.id,
      campaign_id: c.campaignId,
      name: c.name.slice(0, 500),
      status: c.status,
      channel_type: c.channelType,
      channel_sub_type: c.channelSubType,
      bidding_strategy_type: c.biddingStrategyType,
      budget_micros: c.budgetMicros,
      budget_period: c.budgetPeriod,
      updated_at: now,
    })),
    "ad_account_id,campaign_id",
  );

  const metrics = (await searchAll(account.external_id, dailyMetricsQuery(from, today), options)).map(mapDailyMetric).filter((m) => m.campaignId && m.date);
  await upsertChunks(
    db,
    "google_ads_daily_metrics",
    metrics.map((m) => ({
      org_id: account.org_id,
      ad_account_id: account.id,
      campaign_id: m.campaignId,
      date: m.date,
      cost_micros: m.costMicros,
      impressions: m.impressions,
      clicks: m.clicks,
      conversions: m.conversions,
      conversions_value: m.conversionsValue,
      updated_at: now,
    })),
    "ad_account_id,campaign_id,date",
  );

  await db.from("ad_accounts").update({ last_synced_at: now }).eq("org_id", account.org_id).eq("id", account.id);
  return { campaigns: campaigns.length, metricRows: metrics.length };
}

export type GoogleSyncSummary = {
  accounts: number;
  synced: number;
  failed: Array<{ account: string; message: string }>;
  campaigns: number;
  metricRows: number;
  stoppedByBudget: boolean;
};

export async function syncGoogleOrg(
  db: Db,
  orgId: string,
  options: { budgetMs: number; accountIds?: string[] },
): Promise<GoogleSyncSummary> {
  const startedAt = Date.now();
  const ctx = await apiContext(db, orgId);
  let query = db
    .from("ad_accounts")
    .select("id, org_id, external_id, name, currency, timezone, status, client_id, last_synced_at")
    .eq("org_id", orgId)
    .eq("platform", "google")
    .eq("status", "active")
    .order("last_synced_at", { ascending: true, nullsFirst: true });
  if (options.accountIds?.length) query = query.in("id", options.accountIds);
  const { data, error } = await query;
  if (error) throw new Error(`contas: ${error.message}`);

  const accounts = (data ?? []) as GoogleAccountRow[];
  const summary: GoogleSyncSummary = { accounts: accounts.length, synced: 0, failed: [], campaigns: 0, metricRows: 0, stoppedByBudget: false };
  for (const account of accounts) {
    if (Date.now() - startedAt > options.budgetMs) {
      summary.stoppedByBudget = true;
      break;
    }
    try {
      const result = await syncAccount(db, ctx, account, account.last_synced_at ? INCREMENTAL_DAYS : FIRST_SYNC_DAYS);
      summary.synced++;
      summary.campaigns += result.campaigns;
      summary.metricRows += result.metricRows;
    } catch (err) {
      summary.failed.push({
        account: account.name ?? formatCustomerId(account.external_id),
        message: googleErrorMessage(err, ctx.config.serviceAccount?.clientEmail ?? null),
      });
      if (err instanceof GoogleAdsApiError && (err.kind === "auth" || err.kind === "developer_token_not_approved")) break;
    }
  }
  await recordConnectionResult(db, ctx.connection, summary.failed.length && summary.synced === 0 ? new Error(summary.failed[0].message) : null);
  return summary;
}

export type ConnectionTestStep = { label: string; ok: boolean; detail: string };

/** Teste de ponta a ponta mostrado na tela: configuração → credencial → leitura do MCC. */
export async function testGoogleConnection(db: Db, orgId: string): Promise<ConnectionTestStep[]> {
  const config = readGoogleAdsConfig();
  const steps: ConnectionTestStep[] = [
    { label: "Developer token na Vercel", ok: Boolean(config.developerToken), detail: config.developerToken ? "configurado" : "falta GOOGLE_ADS_DEVELOPER_TOKEN" },
    {
      label: "MCC (login-customer-id)",
      ok: Boolean(config.loginCustomerId),
      detail: config.loginCustomerId ? formatCustomerId(config.loginCustomerId) : "falta GOOGLE_ADS_LOGIN_CUSTOMER_ID (ex.: 7205749286)",
    },
  ];
  const connection = await getConnection(db, orgId);
  steps.push({
    label: "Conexão",
    ok: Boolean(connection),
    detail: connection ? (connection.mode === "oauth" ? `login Google${connection.google_email ? ` (${connection.google_email})` : ""}` : `conta de serviço ${config.serviceAccount?.clientEmail ?? "(JSON ausente)"}`) : "ainda não conectado",
  });
  if (!config.developerToken || !connection) return steps;

  try {
    const ctx = await apiContext(db, orgId);
    steps.push({ label: "Credencial aceita pelo Google", ok: true, detail: "access token obtido" });
    const accounts = await fetchAccounts(ctx);
    steps.push({ label: "Leitura das contas", ok: accounts.length > 0, detail: accounts.length > 0 ? `${accounts.length} contas encontradas` : "nenhuma conta de anúncio visível" });
  } catch (err) {
    steps.push({ label: "Chamada à Google Ads API", ok: false, detail: googleErrorMessage(err, config.serviceAccount?.clientEmail ?? null) });
  }
  return steps;
}
