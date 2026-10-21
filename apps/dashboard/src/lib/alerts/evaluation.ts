import type { AlertMetadata, AlertMetric, AlertOperator, AlertSeverity } from "./types";

export const ALERTS_TIMEZONE = "America/Sao_Paulo";

// Severidade = quanto o valor passou do limite, relativo ao limite.
export const SEVERITY_BANDS = { critical: 0.5, warning: 0.2 } as const;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export type MetricTotals = {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
};

export type DailyMetricLike = {
  spend?: unknown;
  impressions?: unknown;
  clicks?: unknown;
  conversions?: unknown;
  revenue_attributed?: unknown;
};

export type EvaluationPeriod = { start: string; end: string; key: string };

export type ApiErrorReason = "status" | "stale" | "never_synced";

export type ApiErrorResult = {
  failing: boolean;
  reason: ApiErrorReason | null;
  hoursSinceSync: number | null;
  severity: AlertSeverity;
};

export type ExistingAlertLike = {
  campaign_id: string | null;
  metadata?: AlertMetadata | null;
  acknowledged_at?: string | null;
  resolved_at?: string | null;
  triggered_at: string;
};

export type DedupeDecision = {
  create: boolean;
  reason: "open" | "acknowledged" | "same_period" | null;
};

function finite(value: unknown): number {
  const num = typeof value === "string" ? Number(value) : value;
  return typeof num === "number" && Number.isFinite(num) ? num : 0;
}

export function aggregateTotals(rows: readonly DailyMetricLike[]): MetricTotals {
  return rows.reduce<MetricTotals>(
    (acc, row) => ({
      spend: acc.spend + finite(row.spend),
      impressions: acc.impressions + finite(row.impressions),
      clicks: acc.clicks + finite(row.clicks),
      conversions: acc.conversions + finite(row.conversions),
      revenue: acc.revenue + finite(row.revenue_attributed),
    }),
    { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 },
  );
}

export function metricValue(metric: AlertMetric, totals: MetricTotals): number | null {
  const { spend, impressions, clicks, conversions, revenue } = totals;
  switch (metric) {
    case "roas":
      return spend > 0 ? revenue / spend : null;
    case "cpa":
      return spend > 0 && conversions > 0 ? spend / conversions : null;
    case "spend_no_conversion":
      return spend > 0 && conversions === 0 ? spend : null;
    case "ctr_below":
      return impressions > 0 ? (clicks / impressions) * 100 : null;
    default:
      return null;
  }
}

export function defaultOperator(metric: AlertMetric): AlertOperator {
  return metric === "roas" || metric === "ctr_below" || metric === "balance_below" ? "lt" : "gt";
}

export function crosses(value: number, operator: AlertOperator, threshold: number): boolean {
  if (operator === "lt") return value < threshold;
  if (operator === "gt") return value > threshold;
  return value === threshold;
}

export function severityFor(value: number, operator: AlertOperator, threshold: number): AlertSeverity {
  if (operator === "eq") return "info";
  if (threshold <= 0) return "warning";
  const gap = operator === "lt" ? (threshold - value) / threshold : (value - threshold) / threshold;
  if (gap >= SEVERITY_BANDS.critical) return "critical";
  if (gap >= SEVERITY_BANDS.warning) return "warning";
  return "info";
}

export function apiErrorCheck(
  account: { status: string | null; last_synced_at: string | null; connected_at?: string | null },
  now: Date,
  staleHours: number,
): ApiErrorResult {
  const syncedAt = account.last_synced_at ? Date.parse(account.last_synced_at) : Number.NaN;
  const hoursSinceSync = Number.isFinite(syncedAt) ? Math.floor((now.getTime() - syncedAt) / HOUR_MS) : null;

  if (account.status && account.status !== "active") {
    return { failing: true, reason: "status", hoursSinceSync, severity: "critical" };
  }
  if (staleHours <= 0) return { failing: false, reason: null, hoursSinceSync, severity: "info" };

  if (hoursSinceSync === null) {
    const connectedAt = account.connected_at ? Date.parse(account.connected_at) : Number.NaN;
    const waitedEnough = Number.isFinite(connectedAt) && now.getTime() - connectedAt >= staleHours * HOUR_MS;
    return waitedEnough
      ? { failing: true, reason: "never_synced", hoursSinceSync, severity: "warning" }
      : { failing: false, reason: null, hoursSinceSync, severity: "info" };
  }

  return hoursSinceSync >= staleHours
    ? { failing: true, reason: "stale", hoursSinceSync, severity: "warning" }
    : { failing: false, reason: null, hoursSinceSync, severity: "info" };
}

export function dateInZone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export function evaluationPeriod(now: Date, timeZone: string = ALERTS_TIMEZONE): EvaluationPeriod {
  const today = dateInZone(now, timeZone);
  const yesterday = new Date(Date.parse(`${today}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10);
  return { start: yesterday, end: yesterday, key: yesterday };
}

export function targetKey(kind: "campaign" | "account", id: string): string {
  return `${kind}:${id}`;
}

function existingTargetKey(alert: ExistingAlertLike): string | null {
  if (alert.metadata?.target_key) return alert.metadata.target_key;
  return alert.campaign_id ? targetKey("campaign", alert.campaign_id) : null;
}

function existingPeriodKey(alert: ExistingAlertLike): string {
  return alert.metadata?.period_end ?? alert.triggered_at.slice(0, 10);
}

export function dedupeDecision(
  existing: readonly ExistingAlertLike[],
  target: string,
  periodKey: string,
): DedupeDecision {
  const sameTarget = existing.filter((alert) => existingTargetKey(alert) === target);
  const unresolved = sameTarget.find((alert) => !alert.resolved_at);
  if (unresolved) return { create: false, reason: unresolved.acknowledged_at ? "acknowledged" : "open" };
  if (sameTarget.some((alert) => existingPeriodKey(alert) === periodKey)) {
    return { create: false, reason: "same_period" };
  }
  return { create: true, reason: null };
}
