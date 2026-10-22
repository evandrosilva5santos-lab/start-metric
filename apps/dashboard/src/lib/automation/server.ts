// Server-side ONLY. Avalia uma regra automática: monta o instantâneo das campanhas no período,
// decide (evaluate.ts), registra cada decisão e, em modo "execute", aplica na Meta/Google.
// Ação real (sucesso ou falha) também vira evento na Central de Histórico.

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptToken } from "@/lib/meta/token";
import { getOrgMetaToken } from "@/lib/meta/org-token";
import { googleErrorMessage, mutateGoogleCampaign } from "@/lib/google-ads/service";
import { DEFAULT_RESULT_ACTION_TYPES } from "@/lib/reports/engine/insights-map";
import { aggregateDailyMetrics, primaryResult, type DailyMetricRow } from "@/lib/reports/engine/metrics";
import { formatCurrency } from "@/lib/reports/engine/render";
import {
  decide,
  type AutomationAction,
  type AutomationMetric,
  type AutomationOperator,
  type Decision,
  type EntitySnapshot,
  type RecentRun,
  type RuleInput,
} from "./evaluate";

type Db = SupabaseClient;

export type AutomationPeriod = "today" | "yesterday" | "last_3d" | "last_7d";

export type RuleRow = {
  id: string;
  org_id: string;
  client_id: string | null;
  ad_account_id: string;
  name: string;
  platform: "meta" | "google";
  entity_external_id: string | null;
  entity_name: string | null;
  metric: AutomationMetric;
  operator: AutomationOperator;
  value: number | string;
  period: AutomationPeriod;
  min_spend: number | string;
  action: AutomationAction;
  action_percent: number | null;
  mode: "simulate" | "execute";
  is_active: boolean;
  cooldown_hours: number;
  max_actions_per_day: number;
};

type AccountRow = { id: string; org_id: string; external_id: string; platform: string; token_encrypted: string | null; client_id: string | null };

const TIMEZONE = "America/Sao_Paulo";
const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_API_VERSION || "v21.0"}`;
const HOUR = 3_600_000;
const ACTOR = "Automação Start Metric";

const METRIC_LABEL: Record<AutomationMetric, string> = {
  cpa: "CPA",
  roas: "ROAS",
  ctr: "CTR",
  cpc: "CPC",
  cpm: "CPM",
  spend: "Gasto",
  conversions: "Conversões",
};

const ACTION_LABEL: Record<AutomationAction, string> = {
  pause: "pausar",
  activate: "ativar",
  decrease_budget: "baixar o orçamento",
  increase_budget: "subir o orçamento",
  notify: "avisar",
};

function localDay(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

export function periodRange(period: AutomationPeriod, now: Date): { since: string; until: string } {
  const today = localDay(now);
  switch (period) {
    case "today":
      return { since: today, until: today };
    case "yesterday":
      return { since: shiftDay(today, -1), until: shiftDay(today, -1) };
    case "last_3d":
      return { since: shiftDay(today, -2), until: today };
    case "last_7d":
      return { since: shiftDay(today, -6), until: today };
  }
}

export function toRuleInput(row: RuleRow): RuleInput {
  return {
    id: row.id,
    metric: row.metric,
    operator: row.operator,
    value: Number(row.value),
    minSpend: Number(row.min_spend),
    action: row.action,
    actionPercent: row.action_percent,
    cooldownHours: row.cooldown_hours,
    maxActionsPerDay: row.max_actions_per_day,
  };
}

function formatMetric(metric: AutomationMetric, value: number): string {
  if (!Number.isFinite(value)) return "sem conversão";
  if (metric === "ctr") return `${value.toFixed(2).replace(".", ",")}%`;
  if (metric === "roas") return value.toFixed(2).replace(".", ",");
  if (metric === "conversions") return String(Math.round(value * 10) / 10).replace(".", ",");
  return formatCurrency(value);
}

export function describeDecision(rule: RuleRow, d: Decision): string {
  const threshold = formatMetric(rule.metric, Number(rule.value));
  const condition = `${METRIC_LABEL[rule.metric]} ${formatMetric(rule.metric, d.metricValue)} ${rule.operator === "above" ? "acima de" : "abaixo de"} ${threshold}`;
  const budget = d.newBudget !== null && d.entity.dailyBudget !== null ? ` (${formatCurrency(d.entity.dailyBudget)} → ${formatCurrency(d.newBudget)}/dia)` : "";
  return `${condition} → ${ACTION_LABEL[d.action]}${budget}`;
}

async function metaEntities(db: Db, rule: RuleRow, range: { since: string; until: string }): Promise<EntitySnapshot[]> {
  let campaignsQuery = db
    .from("campaigns")
    .select("id, meta_id, name, status, daily_budget")
    .eq("org_id", rule.org_id)
    .eq("ad_account_id", rule.ad_account_id);
  if (rule.entity_external_id) campaignsQuery = campaignsQuery.eq("meta_id", rule.entity_external_id);
  const { data: campaigns, error } = await campaignsQuery;
  if (error) throw new Error(`campanhas Meta: ${error.message}`);
  const list = (campaigns ?? []) as Array<{ id: string; meta_id: string; name: string; status: string; daily_budget: number | null }>;
  if (list.length === 0) return [];

  const { data: metrics, error: metricsError } = await db
    .from("daily_metrics")
    .select("campaign_id, spend, impressions, clicks, conversions, revenue_attributed, actions")
    .eq("org_id", rule.org_id)
    .in("campaign_id", list.map((c) => c.id))
    .gte("date", range.since)
    .lte("date", range.until);
  if (metricsError) throw new Error(`métricas Meta: ${metricsError.message}`);
  const byCampaign = new Map<string, DailyMetricRow[]>();
  for (const row of (metrics ?? []) as Array<DailyMetricRow & { campaign_id: string }>) {
    byCampaign.set(row.campaign_id, [...(byCampaign.get(row.campaign_id) ?? []), row]);
  }

  return list.map((c) => {
    const m = aggregateDailyMetrics(byCampaign.get(c.id) ?? []);
    const spend = m.meta_spend ?? 0;
    const conversions = (m.meta_conv ?? 0) > 0 ? m.meta_conv : (primaryResult(m, DEFAULT_RESULT_ACTION_TYPES)?.value ?? 0);
    return {
      externalId: c.meta_id,
      name: c.name,
      status: c.status,
      dailyBudget: c.daily_budget && c.daily_budget > 0 ? Number(c.daily_budget) : null,
      budgetShared: false,
      metrics: {
        spend,
        impressions: m.meta_impressions ?? 0,
        clicks: m.meta_clicks ?? 0,
        conversions,
        value: spend * (m.meta_roas ?? 0),
      },
    };
  });
}

async function googleEntities(db: Db, rule: RuleRow, range: { since: string; until: string }): Promise<EntitySnapshot[]> {
  let campaignsQuery = db
    .from("google_ads_campaigns")
    .select("campaign_id, name, status, budget_micros, budget_period")
    .eq("org_id", rule.org_id)
    .eq("ad_account_id", rule.ad_account_id);
  if (rule.entity_external_id) campaignsQuery = campaignsQuery.eq("campaign_id", rule.entity_external_id);
  const { data: campaigns, error } = await campaignsQuery;
  if (error) throw new Error(`campanhas Google: ${error.message}`);
  const list = (campaigns ?? []) as Array<{ campaign_id: string; name: string; status: string | null; budget_micros: number | string | null; budget_period: string | null }>;
  if (list.length === 0) return [];

  const { data: metrics, error: metricsError } = await db
    .from("google_ads_daily_metrics")
    .select("campaign_id, cost_micros, impressions, clicks, conversions, conversions_value")
    .eq("org_id", rule.org_id)
    .eq("ad_account_id", rule.ad_account_id)
    .in("campaign_id", list.map((c) => c.campaign_id))
    .gte("date", range.since)
    .lte("date", range.until);
  if (metricsError) throw new Error(`métricas Google: ${metricsError.message}`);
  const sums = new Map<string, EntitySnapshot["metrics"]>();
  for (const row of (metrics ?? []) as Array<Record<string, number | string>>) {
    const id = String(row.campaign_id);
    const t = sums.get(id) ?? { spend: 0, impressions: 0, clicks: 0, conversions: 0, value: 0 };
    sums.set(id, {
      spend: t.spend + Number(row.cost_micros) / 1_000_000,
      impressions: t.impressions + Number(row.impressions),
      clicks: t.clicks + Number(row.clicks),
      conversions: t.conversions + Number(row.conversions),
      value: t.value + Number(row.conversions_value),
    });
  }

  return list.map((c) => ({
    externalId: c.campaign_id,
    name: c.name,
    status: c.status ?? "UNKNOWN",
    dailyBudget: c.budget_period === "DAILY" && c.budget_micros !== null ? Number(c.budget_micros) / 1_000_000 : null,
    // Se o orçamento for compartilhado, mutateGoogleCampaign recusa na hora de executar.
    budgetShared: false,
    metrics: sums.get(c.campaign_id) ?? { spend: 0, impressions: 0, clicks: 0, conversions: 0, value: 0 },
  }));
}

async function recentRuns(db: Db, rule: RuleRow, now: Date): Promise<RecentRun[]> {
  const windowHours = Math.max(24, rule.cooldown_hours);
  const { data, error } = await db
    .from("automation_runs")
    .select("entity_external_id, created_at, status")
    .eq("org_id", rule.org_id)
    .eq("rule_id", rule.id)
    .gte("created_at", new Date(now.getTime() - windowHours * HOUR).toISOString());
  if (error) throw new Error(`execuções: ${error.message}`);
  return ((data ?? []) as Array<{ entity_external_id: string; created_at: string; status: RecentRun["status"] }>).map((r) => ({
    entityExternalId: r.entity_external_id,
    createdAt: r.created_at,
    status: r.status,
  }));
}

async function metaToken(db: Db, account: AccountRow): Promise<string> {
  if (account.token_encrypted) {
    try {
      return await decryptToken(account.token_encrypted, db as never);
    } catch {
      // cai para o token da organização
    }
  }
  const org = await getOrgMetaToken(db as never, account.org_id);
  if (!org?.token) throw new Error("Sem token da Meta para esta conta. Reconecte em Integrações → Meta Ads.");
  return org.token;
}

async function executeMeta(db: Db, account: AccountRow, d: Decision): Promise<void> {
  const params = new URLSearchParams({ access_token: await metaToken(db, account) });
  if (d.action === "pause") params.set("status", "PAUSED");
  else if (d.action === "activate") params.set("status", "ACTIVE");
  else if (d.newBudget !== null) params.set("daily_budget", String(Math.round(d.newBudget * 100)));
  const res = await fetch(`${GRAPH}/${d.entity.externalId}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json().catch(() => ({}))) as { error?: { code?: number; message?: string } };
  if (!res.ok || body.error) throw new Error(`Meta (${body.error?.code ?? res.status}): ${body.error?.message ?? "erro desconhecido"}`);
}

async function executeGoogle(db: Db, rule: RuleRow, account: AccountRow, d: Decision): Promise<void> {
  const change =
    d.action === "pause"
      ? { status: "PAUSED" as const }
      : d.action === "activate"
        ? { status: "ENABLED" as const }
        : { dailyBudget: d.newBudget ?? 0 };
  await mutateGoogleCampaign(db, rule.org_id, account.external_id, d.entity.externalId, change);
}

async function recordActivity(db: Db, rule: RuleRow, account: AccountRow, d: Decision, runId: string, error: string | null): Promise<void> {
  const budget = d.action === "increase_budget" || d.action === "decrease_budget";
  const verb = { pause: "pausou", activate: "ativou", decrease_budget: "baixou o orçamento de", increase_budget: "subiu o orçamento de", notify: "avisou sobre" }[d.action];
  const row = {
    dedupe_key: `automation:${runId}`,
    source: "system",
    source_app: ACTOR,
    event_type: `automation.${d.action}`,
    action: budget ? "campaign.budget_changed" : d.action === "pause" ? "campaign.paused" : "campaign.activated",
    category: budget ? "budget" : "status",
    counts_as_work: true,
    classifier_version: 1,
    object_level: "campaign",
    object_external_id: d.entity.externalId,
    object_name: d.entity.name.slice(0, 500),
    campaign_external_id: d.entity.externalId,
    campaign_name: d.entity.name.slice(0, 500),
    account_external_id: account.external_id,
    ad_account_id: account.id,
    title: `Regra "${rule.name}" ${verb} ${d.entity.name}`.slice(0, 300),
    description: describeDecision(rule, d).slice(0, 4000),
    occurred_at: new Date().toISOString(),
    actor_kind: "integration",
    actor_name: ACTOR,
    status: error ? "failed" : "succeeded",
    error_message: error?.slice(0, 500) ?? null,
    before: budget ? { daily_budget: d.entity.dailyBudget } : { status: d.entity.status },
    after: budget ? { daily_budget: d.newBudget } : { status: d.action === "pause" ? "PAUSED" : "ACTIVE" },
    visibility: "internal",
    raw: null,
  };
  const { error: rpcError } = await db.rpc("insert_activity_events", { p_org_id: rule.org_id, p_rows: [row] });
  if (rpcError) console.error("[automation] Central de Histórico:", rpcError.message);
}

export type RuleEvaluation = {
  decisions: Array<Decision & { description: string }>;
  executed: number;
  simulated: number;
  failed: number;
};

/**
 * dryRun = só decide (botão "testar agora"); não grava execução nem toca na conta.
 * Fora do dryRun, regra em "simulate" só registra; em "execute" aplica na plataforma.
 */
export async function evaluateRule(db: Db, rule: RuleRow, options: { now: Date; dryRun: boolean }): Promise<RuleEvaluation> {
  const { data: account, error } = await db
    .from("ad_accounts")
    .select("id, org_id, external_id, platform, token_encrypted, client_id")
    .eq("org_id", rule.org_id)
    .eq("id", rule.ad_account_id)
    .maybeSingle();
  if (error || !account) throw new Error("Conta de anúncio da regra não encontrada");
  const acc = account as AccountRow;

  const range = periodRange(rule.period, options.now);
  const entities = rule.platform === "google" ? await googleEntities(db, rule, range) : await metaEntities(db, rule, range);
  const runs = await recentRuns(db, rule, options.now);
  const decisions = decide(toRuleInput(rule), entities, runs, options.now).map((d) => ({ ...d, description: describeDecision(rule, d) }));
  const result: RuleEvaluation = { decisions, executed: 0, simulated: 0, failed: 0 };
  if (options.dryRun) return result;

  for (const d of decisions.filter((x) => x.skipped === null)) {
    const before = d.newBudget !== null ? d.entity.dailyBudget : null;
    let status: "simulated" | "executed" | "failed" = "simulated";
    let failure: string | null = null;
    if (rule.mode === "execute" && d.action !== "notify") {
      try {
        if (rule.platform === "google") await executeGoogle(db, rule, acc, d);
        else await executeMeta(db, acc, d);
        status = "executed";
      } catch (err) {
        status = "failed";
        failure = rule.platform === "google" ? googleErrorMessage(err) : err instanceof Error ? err.message : String(err);
      }
    }
    const { data: run, error: runError } = await db
      .from("automation_runs")
      .insert({
        org_id: rule.org_id,
        rule_id: rule.id,
        entity_external_id: d.entity.externalId,
        entity_name: d.entity.name.slice(0, 500),
        metric_value: Number.isFinite(d.metricValue) ? d.metricValue : null,
        action: d.action,
        mode: rule.mode,
        status,
        before_value: before,
        after_value: d.newBudget,
        detail: (failure ? `${d.description} · falhou: ${failure}` : d.description).slice(0, 1000),
      })
      .select("id")
      .single();
    if (runError) console.error("[automation] registrar execução:", runError.message);
    if (status !== "simulated" && run) await recordActivity(db, rule, acc, d, (run as { id: string }).id, failure);
    result[status]++;
  }

  const triggered = result.executed + result.simulated + result.failed > 0;
  await db
    .from("automation_rules")
    .update({ last_evaluated_at: options.now.toISOString(), ...(triggered ? { last_triggered_at: options.now.toISOString() } : {}) })
    .eq("org_id", rule.org_id)
    .eq("id", rule.id);
  return result;
}
