export type NumericInput = number | string | null | undefined;
export type ActionCounts = Readonly<Record<string, NumericInput>>;
export type MetricValue = number | string;
export type MetricValues = Record<string, MetricValue>;

export interface DailyMetricRow {
  spend?: NumericInput;
  impressions?: NumericInput;
  clicks?: NumericInput;
  conversions?: NumericInput;
  revenue_attributed?: NumericInput;
  actions?: ActionCounts | null;
  action_values?: ActionCounts | null;
}

interface Totals {
  spend: number | null;
  impressions: number | null;
  clicks: number | null;
  conversions: number | null;
  revenue: number | null;
}

type ScalarField = "spend" | "impressions" | "clicks" | "conversions" | "revenue_attributed";

export function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeActionType(actionType: string): string {
  if (actionType.startsWith("offsite_conversion.")) return actionType.slice("offsite_conversion.".length);
  return actionType.replace(/\./g, "_");
}

function addNullable(acc: number | null, value: number | null): number | null {
  if (value === null) return acc;
  return (acc ?? 0) + value;
}

function sumField(rows: readonly DailyMetricRow[], field: ScalarField): number | null {
  return rows.reduce<number | null>((acc, row) => addNullable(acc, toFiniteNumber(row[field])), null);
}

function sumActions(rows: readonly DailyMetricRow[], field: "actions" | "action_values"): Map<string, number> {
  const sums = new Map<string, number>();
  for (const row of rows) {
    for (const [type, raw] of Object.entries(row[field] ?? {})) {
      const value = toFiniteNumber(raw);
      if (value === null) continue;
      const key = normalizeActionType(type);
      sums.set(key, (sums.get(key) ?? 0) + value);
    }
  }
  return sums;
}

function ratio(numerator: number | null, denominator: number | null, scale = 1): number | undefined {
  if (numerator === null || denominator === null || denominator === 0) return undefined;
  return (numerator / denominator) * scale;
}

function withoutUndefined(entries: ReadonlyArray<readonly [string, number | null | undefined]>): Record<string, number> {
  return Object.fromEntries(entries.filter((e): e is [string, number] => e[1] !== undefined && e[1] !== null));
}

function totalsOf(rows: readonly DailyMetricRow[]): Totals {
  return {
    spend: sumField(rows, "spend"),
    impressions: sumField(rows, "impressions"),
    clicks: sumField(rows, "clicks"),
    conversions: sumField(rows, "conversions"),
    revenue: sumField(rows, "revenue_attributed"),
  };
}

function coreMetrics(t: Totals): Record<string, number> {
  const ctr = ratio(t.clicks, t.impressions, 100);
  const cpc = ratio(t.spend, t.clicks);
  const cpm = ratio(t.spend, t.impressions, 1000);
  return withoutUndefined([
    ["meta_spend", t.spend],
    ["meta_impressions", t.impressions],
    ["meta_clicks", t.clicks],
    ["meta_ctr", ctr],
    ["ctr", ctr],
    ["meta_cpc", cpc],
    ["cpc", cpc],
    ["meta_cpm", cpm],
    ["cpm", cpm],
    ["meta_roas", ratio(t.revenue, t.spend)],
    ["conversion_rate", ratio(t.conversions, t.clicks, 100)],
  ]);
}

function actionMetrics(rows: readonly DailyMetricRow[], spend: number | null): Record<string, number> {
  const counts = sumActions(rows, "actions");
  const values = sumActions(rows, "action_values");
  return withoutUndefined([
    ...[...counts].map(([type, n]) => [`meta_actions.${type}`, n] as const),
    ...[...values].map(([type, v]) => [`meta_action_values.${type}`, v] as const),
    ...[...counts].map(([type, n]) => [`meta_cost_per_action.${type}`, ratio(spend, n)] as const),
  ]);
}

export function aggregateDailyMetrics(rows: readonly DailyMetricRow[]): Record<string, number> {
  const totals = totalsOf(rows);
  return { ...coreMetrics(totals), ...actionMetrics(rows, totals.spend) };
}

function isPresent(value: unknown): value is MetricValue {
  if (typeof value === "string") return value !== "";
  return typeof value === "number" && Number.isFinite(value);
}

type MetricSource = Readonly<Record<string, MetricValue | null | undefined>> | null | undefined;

export function mergeMetrics(...sources: readonly MetricSource[]): MetricValues {
  const entries = sources.flatMap((source) => Object.entries(source ?? {}));
  return Object.fromEntries(entries.filter((e): e is [string, MetricValue] => isPresent(e[1])));
}
