import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AlertMetric, AlertOperator, NotificationRuleRow } from "./types";

type CampaignMetricRow = {
  campaign_id: string;
  spend: number | null;
  conversions: number | null;
  revenue_attributed: number | null;
  campaigns:
    | {
        name: string;
        status: string | null;
      }[]
    | null;
};

type RuleEvalResult = {
  evaluatedRules: number;
  triggeredAlerts: number;
};

function requireEnv(name: "NEXT_PUBLIC_SUPABASE_URL" | "SUPABASE_SERVICE_ROLE_KEY"): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing env var: ${name}`);
  return value;
}

function toNumber(value: number | null | undefined): number {
  if (typeof value !== "number") return 0;
  return Number.isFinite(value) ? value : 0;
}

function safeDivide(numerator: number, denominator: number): number {
  if (!denominator) return 0;
  return numerator / denominator;
}

function compareValue(value: number, operator: AlertOperator, threshold: number): boolean {
  if (operator === "lt") return value < threshold;
  if (operator === "gt") return value > threshold;
  return value === threshold;
}

function metricValue(metric: AlertMetric, row: CampaignMetricRow): number {
  const spend = toNumber(row.spend);
  const conversions = toNumber(row.conversions);
  const revenue = toNumber(row.revenue_attributed);

  if (metric === "roas") return safeDivide(revenue, spend);
  if (metric === "cpa") return safeDivide(spend, conversions);
  if (metric === "spend_no_conversion") return conversions === 0 ? spend : 0;
  return 0;
}

function metricTitle(metric: AlertMetric): string {
  if (metric === "roas") return "ROAS abaixo do limite";
  if (metric === "cpa") return "CPA acima do limite";
  return "Gasto sem conversão";
}

function buildMessage(rule: NotificationRuleRow, row: CampaignMetricRow, observed: number): string {
  const campaignName = row.campaigns?.[0]?.name ?? row.campaign_id;
  if (rule.metric === "roas") {
    return `Campanha "${campaignName}" com ROAS ${observed.toFixed(2)}x (limite ${rule.operator} ${rule.threshold.toFixed(2)}x).`;
  }
  if (rule.metric === "cpa") {
    return `Campanha "${campaignName}" com CPA ${observed.toFixed(2)} (limite ${rule.operator} ${rule.threshold.toFixed(2)}).`;
  }
  return `Campanha "${campaignName}" gastou ${observed.toFixed(2)} sem conversões (limite ${rule.operator} ${rule.threshold.toFixed(2)}).`;
}

function createServiceClient(): SupabaseClient {
  return createServerClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { cookies: { getAll: () => [], setAll: () => {} } },
  );
}

export async function runAlertsMonitor(referenceDate?: string): Promise<RuleEvalResult> {
  const supabase = createServiceClient();
  const dateCutoff = referenceDate ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data: rulesData, error: rulesError } = await supabase
    .from("notification_rules")
    .select("id, org_id, campaign_id, metric, operator, threshold, channel, active, created_at, updated_at")
    .eq("active", true);

  if (rulesError) {
    throw new Error(`ALERT_RULES_QUERY_ERROR:${rulesError.message}`);
  }

  const rules = (rulesData ?? []) as NotificationRuleRow[];
  let triggeredAlerts = 0;

  for (const rule of rules) {
    let metricsQuery = supabase
      .from("daily_metrics")
      .select("campaign_id, spend, conversions, revenue_attributed, campaigns!inner(name, status)")
      .eq("org_id", rule.org_id)
      .gte("date", dateCutoff);

    if (rule.campaign_id) {
      metricsQuery = metricsQuery.eq("campaign_id", rule.campaign_id);
    }

    const { data: metricRows, error: metricError } = await metricsQuery;
    if (metricError) {
      continue;
    }

    const metrics = (metricRows ?? []) as CampaignMetricRow[];
    for (const metric of metrics) {
      const observed = metricValue(rule.metric, metric);
      const shouldTrigger = compareValue(observed, rule.operator, toNumber(rule.threshold));

      if (!shouldTrigger) continue;

      const { data: existing } = await supabase
        .from("alerts")
        .select("id")
        .eq("rule_id", rule.id)
        .eq("campaign_id", metric.campaign_id)
        .eq("status", "unread")
        .gte("triggered_at", new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (existing && existing.length > 0) {
        continue;
      }

      const { error: insertError } = await supabase.from("alerts").insert({
        org_id: rule.org_id,
        rule_id: rule.id,
        campaign_id: metric.campaign_id,
        metric: rule.metric,
        operator: rule.operator,
        threshold: rule.threshold,
        observed_value: observed,
        channel: rule.channel,
        title: metricTitle(rule.metric),
        message: buildMessage(rule, metric, observed),
        status: "unread",
        metadata: {
          campaignStatus: metric.campaigns?.[0]?.status ?? null,
          evaluatedAt: new Date().toISOString(),
          window: "24h",
        },
      });

      if (!insertError) {
        triggeredAlerts += 1;
      }
    }
  }

  return {
    evaluatedRules: rules.length,
    triggeredAlerts,
  };
}
