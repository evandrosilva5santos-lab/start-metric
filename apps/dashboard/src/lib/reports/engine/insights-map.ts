import { toFiniteNumber, type MetricValues } from "./metrics";
import { formatNumber, type CreativeRow } from "./render";

export interface GraphAction {
  action_type: string;
  value: string | number;
}

export interface GraphError {
  code?: number;
  message?: string;
}

export interface AccountInsightRow {
  reach?: string | number;
  frequency?: string | number;
  video_play_actions?: readonly GraphAction[];
  video_thruplay_watched_actions?: readonly GraphAction[];
  video_p25_watched_actions?: readonly GraphAction[];
  video_p50_watched_actions?: readonly GraphAction[];
  video_p75_watched_actions?: readonly GraphAction[];
  video_p95_watched_actions?: readonly GraphAction[];
  video_p100_watched_actions?: readonly GraphAction[];
  video_avg_time_watched_actions?: readonly GraphAction[];
}

export interface AdInsightRow {
  ad_id: string;
  ad_name?: string;
  spend?: string | number;
  impressions?: string | number;
  clicks?: string | number;
  actions?: readonly GraphAction[];
}

export interface CreativeRankingOptions {
  limit: number;
  resultActionTypes?: readonly string[];
  urls?: Readonly<Record<string, string>>;
}

type VideoField = Exclude<keyof AccountInsightRow, "reach" | "frequency" | "video_avg_time_watched_actions">;

const VIDEO_SLUGS: ReadonlyArray<readonly [VideoField, string]> = [
  ["video_play_actions", "meta_video_play.video_view"],
  ["video_thruplay_watched_actions", "meta_video_thruplay.video_view"],
  ["video_p25_watched_actions", "meta_video_p25.video_view"],
  ["video_p50_watched_actions", "meta_video_p50.video_view"],
  ["video_p75_watched_actions", "meta_video_p75.video_view"],
  ["video_p95_watched_actions", "meta_video_p95.video_view"],
  ["video_p100_watched_actions", "meta_video_p100.video_view"],
];

export const ACCOUNT_INSIGHT_FIELDS: readonly string[] = [
  "reach",
  "frequency",
  ...VIDEO_SLUGS.map(([field]) => field),
  "video_avg_time_watched_actions",
];

export const AD_INSIGHT_FIELDS: readonly string[] = ["ad_id", "ad_name", "spend", "impressions", "clicks", "actions"];

export const DEFAULT_RESULT_ACTION_TYPES: readonly string[] = [
  "purchase",
  "omni_purchase",
  "offsite_conversion.fb_pixel_purchase",
  "lead",
  "onsite_conversion.lead_grouped",
  "offsite_conversion.fb_pixel_lead",
  "onsite_conversion.messaging_conversation_started_7d",
  "complete_registration",
];

const TOKEN_EXPIRED_CODE = 190;
const RATE_LIMIT_CODES: ReadonlySet<number> = new Set([4, 17, 32, 613, 80004]);

export function actionValue(actions: readonly GraphAction[] | undefined, actionType: string): number | null {
  const match = actions?.find((a) => a.action_type === actionType);
  return match ? toFiniteNumber(match.value) : null;
}

function videoMetrics(row: AccountInsightRow): Array<readonly [string, number | string | null]> {
  const counts = VIDEO_SLUGS.map(([field, slug]) => [slug, actionValue(row[field], "video_view")] as const);
  const avg = actionValue(row.video_avg_time_watched_actions, "video_view");
  return [...counts, ["meta_video_avg_time.video_view", avg === null ? null : `${formatNumber(avg)} seg`]];
}

export function mapAccountInsightRow(row: AccountInsightRow | undefined): MetricValues {
  if (!row) return {};
  const entries = [
    ["meta_reach", toFiniteNumber(row.reach)] as const,
    ["meta_frequency", toFiniteNumber(row.frequency)] as const,
    ...videoMetrics(row),
  ];
  return Object.fromEntries(entries.filter((e): e is readonly [string, number | string] => e[1] !== null));
}

function pickResultActionType(rows: readonly AdInsightRow[], priority: readonly string[]): string | null {
  return priority.find((type) => rows.some((row) => (actionValue(row.actions, type) ?? 0) > 0)) ?? null;
}

export interface RankedAd {
  adId: string;
  creative: CreativeRow;
}

function toRankedAd(row: AdInsightRow, actionType: string, urls: Readonly<Record<string, string>>): RankedAd | null {
  const results = actionValue(row.actions, actionType) ?? 0;
  if (results <= 0) return null;
  const spend = toFiniteNumber(row.spend) ?? 0;
  const impressions = toFiniteNumber(row.impressions) ?? 0;
  const clicks = toFiniteNumber(row.clicks) ?? 0;
  const creative: CreativeRow = {
    name: row.ad_name || row.ad_id,
    results,
    cpa: spend / results,
    ctr: impressions > 0 ? (clicks / impressions) * 100 : 0,
  };
  const url = urls[row.ad_id];
  return { adId: row.ad_id, creative: url ? { ...creative, url } : creative };
}

function byBestResult(a: RankedAd, b: RankedAd): number {
  return b.creative.results - a.creative.results || a.creative.cpa - b.creative.cpa;
}

export function rankAds(rows: readonly AdInsightRow[], options: CreativeRankingOptions): RankedAd[] {
  const actionType = pickResultActionType(rows, options.resultActionTypes ?? DEFAULT_RESULT_ACTION_TYPES);
  if (!actionType) return [];
  const urls = options.urls ?? {};
  return rows
    .map((row) => toRankedAd(row, actionType, urls))
    .filter((ad): ad is RankedAd => ad !== null)
    .sort(byBestResult)
    .slice(0, options.limit);
}

export function mapCreativeRows(rows: readonly AdInsightRow[], options: CreativeRankingOptions): CreativeRow[] {
  return rankAds(rows, options).map((ad) => ad.creative);
}

export function describeGraphError(error: GraphError): string {
  const code = error.code ?? 0;
  const message = error.message ?? "erro desconhecido";
  if (code === TOKEN_EXPIRED_CODE) {
    return "A conexão com a Meta expirou ou foi invalidada. Reconecte a conta em Configurações > Meta Ads.";
  }
  if (RATE_LIMIT_CODES.has(code)) {
    return `A Meta atingiu o limite de requisições (${code}). Tente de novo em alguns minutos.`;
  }
  return `Erro da Meta (${code}): ${message}`;
}
