import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { listOperationalAccounts } from "@/lib/accounts/operational";
import { buildAlertInsert, type AlertCandidate } from "./build";
import {
  ALERTS_TIMEZONE,
  aggregateTotals,
  apiErrorCheck,
  crosses,
  dateInZone,
  dedupeDecision,
  evaluationPeriod,
  metricValue,
  targetKey,
  type DailyMetricLike,
  type EvaluationPeriod,
  type ExistingAlertLike,
} from "./evaluation";
import type { AlertMetric, AlertOperator } from "./types";

type RuleEvalResult = {
  evaluatedRules: number;
  skippedRules: number;
  triggeredAlerts: number;
  failedRules: number;
};

type MonitorRule = {
  id: string;
  org_id: string;
  campaign_id: string | null;
  client_id: string | null;
  ad_account_id: string | null;
  metric: AlertMetric;
  operator: AlertOperator;
  threshold: number;
  channel: string;
  template_body: string | null;
};

type Relation<T> = T | T[] | null;

type AccountRow = {
  id: string;
  name: string | null;
  currency: string | null;
  status: string | null;
  last_synced_at: string | null;
  connected_at: string | null;
  client_id: string | null;
  clients: Relation<{ name: string | null }>;
};

type MetricRow = DailyMetricLike & {
  campaign_id: string;
  campaigns: Relation<{ name: string | null; ad_account_id: string | null }>;
};

type OrgData = { accounts: Map<string, AccountRow>; metrics: MetricRow[] };

const EXISTING_LOOKBACK_DAYS = 7;
const DEFAULT_STALE_HOURS = 24;

function requireEnv(name: "NEXT_PUBLIC_SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY"): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function createServiceClient(): SupabaseClient<Database> {
  return createServerClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}

function one<T>(relation: Relation<T>): T | null {
  if (Array.isArray(relation)) return relation[0] ?? null;
  return relation ?? null;
}

async function loadOrgData(supabase: SupabaseClient<Database>, orgId: string, period: EvaluationPeriod): Promise<OrgData> {
  const [inventory, metricsRes] = await Promise.all([
    listOperationalAccounts(supabase, orgId),
    supabase
      .from("daily_metrics")
      .select("campaign_id, spend, impressions, clicks, conversions, revenue_attributed, campaigns!inner(name, ad_account_id)")
      .eq("org_id", orgId)
      .gte("date", period.start)
      .lte("date", period.end),
  ]);
  if (metricsRes.error) throw new Error(`ALERT_METRICS_QUERY_ERROR:${metricsRes.error.message}`);

  const accounts = new Map(
    inventory.accounts.map((account) => [
      account.id,
      {
        id: account.id,
        name: account.name,
        currency: account.currency,
        status: account.status,
        last_synced_at: account.last_synced_at,
        connected_at: account.connected_at,
        client_id: account.client_id,
        clients: { name: account.client.name },
      } satisfies AccountRow,
    ]),
  );
  return { accounts, metrics: (metricsRes.data ?? []) as MetricRow[] };
}

function accountsInScope(rule: MonitorRule, accounts: Map<string, AccountRow>): AccountRow[] {
  return [...accounts.values()].filter((account) => {
    if (rule.ad_account_id) return account.id === rule.ad_account_id;
    if (rule.client_id) return account.client_id === rule.client_id;
    return true;
  });
}

function accountFields(account: AccountRow | undefined) {
  return {
    accountId: account?.id ?? null,
    accountName: account?.name ?? null,
    clientId: account?.client_id ?? null,
    clientName: one(account?.clients ?? null)?.name ?? null,
    currency: account?.currency ?? null,
    accountStatus: account?.status ?? null,
  };
}

function apiErrorCandidates(rule: MonitorRule, data: OrgData, now: Date): AlertCandidate[] {
  const threshold = Number(rule.threshold);
  const staleHours = Number.isFinite(threshold) ? threshold : DEFAULT_STALE_HOURS;
  return accountsInScope(rule, data.accounts).flatMap((account) => {
    const check = apiErrorCheck(account, now, staleHours);
    if (!check.failing) return [];
    return [
      {
        kind: "account" as const,
        id: account.id,
        value: check.hoursSinceSync ?? 0,
        campaignName: null,
        spend: null,
        severity: check.severity,
        ...accountFields(account),
      },
    ];
  });
}

function metricCandidates(rule: MonitorRule, data: OrgData): AlertCandidate[] {
  const scoped = new Set(accountsInScope(rule, data.accounts).map((account) => account.id));
  const groups = new Map<string, { rows: MetricRow[]; accountId: string | null; campaignName: string | null }>();

  for (const row of data.metrics) {
    const campaign = one(row.campaigns);
    const accountId = campaign?.ad_account_id ?? null;
    if (!accountId || !scoped.has(accountId)) continue;
    if (rule.campaign_id && row.campaign_id !== rule.campaign_id) continue;

    const key = rule.campaign_id ? row.campaign_id : accountId;
    const group = groups.get(key) ?? { rows: [], accountId, campaignName: rule.campaign_id ? campaign?.name ?? null : null };
    groups.set(key, { ...group, rows: [...group.rows, row] });
  }

  return [...groups.entries()].flatMap(([id, group]) => {
    const totals = aggregateTotals(group.rows);
    const value = metricValue(rule.metric, totals);
    if (value === null || !crosses(value, rule.operator, Number(rule.threshold))) return [];
    return [
      {
        kind: rule.campaign_id ? ("campaign" as const) : ("account" as const),
        id,
        value,
        campaignName: group.campaignName,
        spend: totals.spend,
        ...accountFields(group.accountId ? data.accounts.get(group.accountId) : undefined),
      },
    ];
  });
}

async function existingAlerts(supabase: SupabaseClient<Database>, ruleId: string, now: Date): Promise<ExistingAlertLike[]> {
  const since = new Date(now.getTime() - EXISTING_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("alerts")
    .select("campaign_id, metadata, acknowledged_at, resolved_at, triggered_at")
    .eq("rule_id", ruleId)
    .or(`resolved_at.is.null,triggered_at.gte."${since}"`);
  if (error) throw new Error(`ALERT_EXISTING_QUERY_ERROR:${error.message}`);
  return (data ?? []) as ExistingAlertLike[];
}

async function evaluateRule(
  supabase: SupabaseClient<Database>,
  rule: MonitorRule,
  data: OrgData,
  period: EvaluationPeriod,
  now: Date,
): Promise<number> {
  const candidates = rule.metric === "api_error" ? apiErrorCandidates(rule, data, now) : metricCandidates(rule, data);
  if (candidates.length === 0) return 0;

  const existing = await existingAlerts(supabase, rule.id, now);
  const periodKey = rule.metric === "api_error" ? dateInZone(now, ALERTS_TIMEZONE) : period.key;
  const effectivePeriod = rule.metric === "api_error" ? { start: periodKey, end: periodKey, key: periodKey } : period;

  const inserts = candidates
    .filter((candidate) => dedupeDecision(existing, targetKey(candidate.kind, candidate.id), periodKey).create)
    .map((candidate) => buildAlertInsert(rule, candidate, effectivePeriod, now));
  if (inserts.length === 0) return 0;

  const { error } = await supabase.from("alerts").insert(inserts);
  if (error) throw new Error(`ALERT_INSERT_ERROR:${error.message}`);
  return inserts.length;
}

export async function runAlertsMonitor(now: Date = new Date()): Promise<RuleEvalResult> {
  const supabase = createServiceClient();
  const period = evaluationPeriod(now);

  const { data: rulesData, error: rulesError } = await supabase
    .from("notification_rules")
    .select("id, org_id, campaign_id, client_id, ad_account_id, metric, operator, threshold, channel, template_body")
    .eq("active", true);
  if (rulesError) throw new Error(`ALERT_RULES_QUERY_ERROR:${rulesError.message}`);

  const rules = (rulesData ?? []) as MonitorRule[];
  const orgCache = new Map<string, Promise<OrgData>>();
  const result: RuleEvalResult = { evaluatedRules: 0, skippedRules: 0, triggeredAlerts: 0, failedRules: 0 };

  for (const rule of rules) {
    if (rule.metric === "balance_below") {
      result.skippedRules += 1;
      continue;
    }
    try {
      if (!orgCache.has(rule.org_id)) orgCache.set(rule.org_id, loadOrgData(supabase, rule.org_id, period));
      const data = await (orgCache.get(rule.org_id) as Promise<OrgData>);
      result.triggeredAlerts += await evaluateRule(supabase, rule, data, period, now);
      result.evaluatedRules += 1;
    } catch (error) {
      result.failedRules += 1;
      console.error("[alerts-monitor] rule failed", rule.id, error instanceof Error ? error.message : error);
    }
  }

  return result;
}
