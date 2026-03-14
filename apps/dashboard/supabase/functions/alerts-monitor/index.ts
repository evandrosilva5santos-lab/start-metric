import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

type AlertMetric = "roas" | "cpa" | "spend_no_conversion";
type AlertOperator = "lt" | "gt" | "eq";

type RuleRow = {
  id: string;
  org_id: string;
  campaign_id: string | null;
  metric: AlertMetric;
  operator: AlertOperator;
  threshold: number;
  channel: "web_push";
};

type MetricRow = {
  campaign_id: string;
  spend: number | null;
  conversions: number | null;
  revenue_attributed: number | null;
  campaigns: { name: string; status: string | null } | null;
};

function safeDivide(a: number, b: number): number {
  if (!b) return 0;
  return a / b;
}

function toNumber(value: number | null | undefined): number {
  if (typeof value !== "number") return 0;
  return Number.isFinite(value) ? value : 0;
}

function compareValue(value: number, operator: AlertOperator, threshold: number): boolean {
  if (operator === "lt") return value < threshold;
  if (operator === "gt") return value > threshold;
  return value === threshold;
}

function metricValue(metric: AlertMetric, row: MetricRow): number {
  const spend = toNumber(row.spend);
  const conversions = toNumber(row.conversions);
  const revenue = toNumber(row.revenue_attributed);

  if (metric === "roas") return safeDivide(revenue, spend);
  if (metric === "cpa") return safeDivide(spend, conversions);
  return conversions === 0 ? spend : 0;
}

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const start = Date.now();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const { data: rulesData, error: rulesError } = await supabase
    .from("notification_rules")
    .select("id, org_id, campaign_id, metric, operator, threshold, channel")
    .eq("active", true);

  if (rulesError) {
    return new Response(JSON.stringify({ error: rulesError.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const rules = (rulesData ?? []) as RuleRow[];
  let triggeredAlerts = 0;

  for (const rule of rules) {
    let query = supabase
      .from("daily_metrics")
      .select("campaign_id, spend, conversions, revenue_attributed, campaigns!inner(name, status)")
      .eq("org_id", rule.org_id)
      .gte("date", cutoff);

    if (rule.campaign_id) query = query.eq("campaign_id", rule.campaign_id);

    const { data, error } = await query;
    if (error) continue;

    const rows = (data ?? []) as MetricRow[];
    for (const row of rows) {
      const observed = metricValue(rule.metric, row);
      if (!compareValue(observed, rule.operator, toNumber(rule.threshold))) continue;

      const { data: existing } = await supabase
        .from("alerts")
        .select("id")
        .eq("rule_id", rule.id)
        .eq("campaign_id", row.campaign_id)
        .eq("status", "unread")
        .gte("triggered_at", new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if (existing && existing.length > 0) continue;

      const title =
        rule.metric === "roas"
          ? "ROAS abaixo do limite"
          : rule.metric === "cpa"
            ? "CPA acima do limite"
            : "Gasto sem conversão";

      const { error: insertError } = await supabase.from("alerts").insert({
        org_id: rule.org_id,
        rule_id: rule.id,
        campaign_id: row.campaign_id,
        metric: rule.metric,
        operator: rule.operator,
        threshold: rule.threshold,
        observed_value: observed,
        channel: rule.channel,
        title,
        message: `${title} na campanha "${row.campaigns?.name ?? row.campaign_id}"`,
        status: "unread",
        metadata: { edgeFunction: true, evaluatedAt: new Date().toISOString() },
      });

      if (!insertError) triggeredAlerts += 1;
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      evaluatedRules: rules.length,
      triggeredAlerts,
      durationMs: Date.now() - start,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
});
