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
    ["meta_conv", t.conversions],
    ["conversion_rate", ratio(t.conversions, t.clicks, 100)],
  ]);
}

/** Primeiro tipo de ação da lista de prioridade com resultado no período (ex.: compras antes de cadastros). */
export function primaryResult(
  metrics: Readonly<Record<string, MetricValue | null | undefined>>,
  priority: readonly string[],
): { type: string; value: number } | null {
  for (const actionType of priority) {
    const type = normalizeActionType(actionType);
    const value = metrics[`meta_actions.${type}`];
    if (typeof value === "number" && value > 0) return { type, value };
  }
  return null;
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

/** Linha de `google_ads_daily_metrics`; o custo vem em micros (1.000.000 = R$ 1). */
export interface GoogleDailyRow {
  cost_micros: NumericInput;
  impressions: NumericInput;
  clicks: NumericInput;
  conversions: NumericInput;
  conversions_value: NumericInput;
  interactions?: NumericInput;
  all_conversions?: NumericInput;
  all_conversions_value?: NumericInput;
  /** Frações 0–1 vindas da API; nulas quando a campanha não tem a métrica. */
  search_impression_share?: NumericInput;
  search_budget_lost_impression_share?: NumericInput;
  search_rank_lost_impression_share?: NumericInput;
  content_budget_lost_impression_share?: NumericInput;
  top_impression_percentage?: NumericInput;
  absolute_top_impression_percentage?: NumericInput;
  video_views?: NumericInput;
  video_view_rate?: NumericInput;
}

const MICROS = 1_000_000;

function sumGoogle(rows: readonly GoogleDailyRow[], field: keyof GoogleDailyRow): number {
  return rows.reduce((total, row) => total + (toFiniteNumber(row[field]) ?? 0), 0);
}

type ShareField =
  | "search_impression_share"
  | "search_budget_lost_impression_share"
  | "search_rank_lost_impression_share"
  | "content_budget_lost_impression_share"
  | "top_impression_percentage"
  | "absolute_top_impression_percentage"
  | "video_view_rate";

/** Média das frações ponderada pelas impressões de cada linha, em pontos percentuais. */
function weightedShare(rows: readonly GoogleDailyRow[], field: ShareField): number | undefined {
  let weighted = 0;
  let weight = 0;
  for (const row of rows) {
    const share = toFiniteNumber(row[field]);
    const impressions = toFiniteNumber(row.impressions) ?? 0;
    if (share === null || impressions <= 0) continue;
    weighted += share * impressions;
    weight += impressions;
  }
  return weight > 0 ? (weighted / weight) * 100 : undefined;
}

const GOOGLE_SHARES: ReadonlyArray<readonly [ShareField, string]> = [
  ["search_impression_share", "google_search_impression_share"],
  ["search_budget_lost_impression_share", "google_search_budget_lost_impression_share"],
  ["search_rank_lost_impression_share", "google_search_rank_lost_impression_share"],
  ["content_budget_lost_impression_share", "google_content_budget_lost_impression_share"],
  ["top_impression_percentage", "google_top_impression_percentage"],
  ["absolute_top_impression_percentage", "google_absolute_top_impression_percentage"],
  ["video_view_rate", "google_video_trueview_view_rate"],
];

function googleExtras(rows: readonly GoogleDailyRow[], spend: number, conversions: number): Array<readonly [string, number | undefined]> {
  const interactions = sumGoogle(rows, "interactions");
  const allConversions = sumGoogle(rows, "all_conversions");
  const allValue = sumGoogle(rows, "all_conversions_value");
  const videoRows = rows.filter((row) => (toFiniteNumber(row.video_views) ?? 0) > 0);
  const videoViews = sumGoogle(videoRows, "video_views");
  const videoSpend = sumGoogle(videoRows, "cost_micros") / MICROS;
  return [
    ["google_all_conversions", allConversions > 0 ? allConversions : undefined],
    ["google_all_conversions_value", allValue > 0 ? allValue : undefined],
    ["google_all_roas", allValue > 0 ? ratio(allValue, spend) : undefined],
    ["google_cost_per_all_conversions", ratio(spend, allConversions)],
    ["google_conversions_from_interactions_rate", ratio(conversions, interactions, 100)],
    ["google_all_conversions_from_interactions_rate", ratio(allConversions, interactions, 100)],
    ["google_video_trueview_views", videoViews > 0 ? videoViews : undefined],
    ["google_trueview_average_cpv", ratio(videoSpend, videoViews)],
    ...GOOGLE_SHARES.map(([field, slug]) => [slug, weightedShare(rows, field)] as const),
  ];
}

export function aggregateGoogleRows(rows: readonly GoogleDailyRow[]): Record<string, number> {
  if (rows.length === 0) return {};
  const spend = sumGoogle(rows, "cost_micros") / MICROS;
  const impressions = sumGoogle(rows, "impressions");
  const clicks = sumGoogle(rows, "clicks");
  const conversions = sumGoogle(rows, "conversions");
  const value = sumGoogle(rows, "conversions_value");
  return withoutUndefined([
    ["google_spend", spend],
    ["google_impressions", impressions],
    ["google_clicks", clicks],
    ["google_conversions", conversions],
    ["google_conversions_value", value],
    ["google_ctr", ratio(clicks, impressions, 100)],
    ["google_cpc", ratio(spend, clicks)],
    ["google_cpm", ratio(spend, impressions, 1000)],
    ["google_cost_per_conversion", ratio(spend, conversions)],
    ["google_roas", ratio(value, spend)],
    ...googleExtras(rows, spend, conversions),
  ]);
}

function numberOf(metrics: Readonly<Record<string, MetricValue | null | undefined>>, slug: string): number | null {
  const value = metrics[slug];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sumPresent(...values: Array<number | null>): number | null {
  const present = values.filter((v): v is number => v !== null);
  return present.length === 0 ? null : present.reduce((a, b) => a + b, 0);
}

/**
 * Variáveis "(total)" a partir das métricas já calculadas por canal. A receita da Meta volta de
 * meta_roas × meta_spend (o ROAS da Meta é exatamente receita ÷ investimento).
 */
export function totalMetrics(metrics: Readonly<Record<string, MetricValue | null | undefined>>): Record<string, number> {
  const metaSpend = numberOf(metrics, "meta_spend");
  const metaRoas = numberOf(metrics, "meta_roas");
  const metaRevenue = metaSpend !== null && metaRoas !== null ? metaSpend * metaRoas : null;
  const spend = sumPresent(metaSpend, numberOf(metrics, "google_spend"));
  const impressions = sumPresent(numberOf(metrics, "meta_impressions"), numberOf(metrics, "google_impressions"));
  const clicks = sumPresent(numberOf(metrics, "meta_clicks"), numberOf(metrics, "google_clicks"));
  const revenue = sumPresent(metaRevenue, numberOf(metrics, "google_conversions_value"));
  return withoutUndefined([
    ["spend", spend],
    ["impressions", impressions],
    ["clicks", clicks],
    ["reach", numberOf(metrics, "meta_reach")],
    ["ctr", ratio(clicks, impressions, 100)],
    ["cpc", ratio(spend, clicks)],
    ["cpm", ratio(spend, impressions, 1000)],
    ["roas", ratio(revenue, spend)],
  ]);
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
