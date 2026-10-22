// Consultas GAQL e leitura das respostas das abas de análise (palavras-chave, termos, dispositivo, local,
// sexo, idade e visibilidade). Módulo puro: não acessa rede nem banco.
// Na resposta REST, int64 vem como texto e campos com valor padrão (0) podem faltar.

import { deriveMetrics, maskPii, type DerivedMetrics } from "./insights-core";

type Row = Record<string, Record<string, unknown> | undefined>;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const CAMPAIGN_ID = /^\d{1,20}$/;
const GEO_ID = /^\d{1,12}$/;
const ROW_LIMIT = 500;
const GEO_ROW_LIMIT = 1000;
const METRICS = "metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value";

export type InsightRange = { from: string; to: string; campaignId?: string };
export type GeoLevel = "country" | "region" | "city";
export type GeoLocationType = "presence" | "interest";

function assertDay(day: string): string {
  if (!DAY.test(day)) throw new Error(`data inválida: ${day}`);
  return day;
}

function assertCampaignId(id: string): string {
  if (!CAMPAIGN_ID.test(id)) throw new Error(`campanha inválida: ${id}`);
  return id;
}

function where(range: InsightRange, extra = ""): string {
  const campaign = range.campaignId ? ` AND campaign.id = ${assertCampaignId(range.campaignId)}` : "";
  return `segments.date BETWEEN '${assertDay(range.from)}' AND '${assertDay(range.to)}' AND metrics.impressions > 0${campaign}${extra}`;
}

export function keywordsDetailQuery(range: InsightRange): string {
  return [
    "SELECT campaign.id, campaign.name, ad_group.id, ad_group.name,",
    "ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type, ad_group_criterion.status,",
    `ad_group_criterion.quality_info.quality_score, ${METRICS}`,
    `FROM keyword_view WHERE ${where(range)}`,
    `ORDER BY metrics.cost_micros DESC LIMIT ${ROW_LIMIT}`,
  ].join(" ");
}

export function searchTermsQuery(range: InsightRange): string {
  return [
    "SELECT search_term_view.search_term, search_term_view.status,",
    "segments.keyword.info.text, segments.keyword.info.match_type,",
    `campaign.id, campaign.name, ad_group.id, ad_group.name, ${METRICS}`,
    `FROM search_term_view WHERE ${where(range)}`,
    `ORDER BY metrics.cost_micros DESC LIMIT ${ROW_LIMIT}`,
  ].join(" ");
}

export function deviceQuery(range: InsightRange): string {
  return `SELECT segments.device, ${METRICS} FROM campaign WHERE ${where(range)}`;
}

export function genderQuery(range: InsightRange): string {
  return `SELECT ad_group_criterion.gender.type, ${METRICS} FROM gender_view WHERE ${where(range)}`;
}

export function ageQuery(range: InsightRange): string {
  return `SELECT ad_group_criterion.age_range.type, ${METRICS} FROM age_range_view WHERE ${where(range)}`;
}

const GEO_FIELD: Record<GeoLevel, string> = {
  country: "geographic_view.country_criterion_id",
  region: "segments.geo_target_region",
  city: "segments.geo_target_city",
};

const GEO_TYPE: Record<GeoLocationType, string> = {
  presence: "LOCATION_OF_PRESENCE",
  interest: "AREA_OF_INTEREST",
};

export function geoQuery(options: InsightRange & { level: GeoLevel; locationType: GeoLocationType }): string {
  const type = ` AND geographic_view.location_type = '${GEO_TYPE[options.locationType]}'`;
  return [
    `SELECT ${GEO_FIELD[options.level]}, ${METRICS}`,
    `FROM geographic_view WHERE ${where(options, type)}`,
    `ORDER BY metrics.cost_micros DESC LIMIT ${GEO_ROW_LIMIT}`,
  ].join(" ");
}

export function geoNamesQuery(ids: readonly string[]): string {
  const safe = ids.map((id) => {
    if (!GEO_ID.test(id)) throw new Error(`local inválido: ${id}`);
    return id;
  });
  return `SELECT geo_target_constant.id, geo_target_constant.canonical_name, geo_target_constant.name FROM geo_target_constant WHERE geo_target_constant.id IN (${safe.join(", ")})`;
}

/** Sem `segments.date` no SELECT: a parcela de impressões do período não se obtém somando nem tirando média dos dias. */
export function visibilityQuery(range: InsightRange): string {
  return [
    "SELECT campaign.id, campaign.name, campaign.advertising_channel_type, metrics.impressions, metrics.cost_micros,",
    "metrics.search_impression_share, metrics.search_budget_lost_impression_share,",
    "metrics.search_rank_lost_impression_share, metrics.top_impression_percentage,",
    "metrics.absolute_top_impression_percentage",
    `FROM campaign WHERE ${where(range)}`,
    "ORDER BY metrics.cost_micros DESC",
  ].join(" ");
}

const text = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : 0;
  return Number.isFinite(n) ? n : 0;
};
const fraction = (v: unknown): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

export type MetricFields = DerivedMetrics & { impressions: number; clicks: number; conversions: number; conversionsValue: number };

type Totals = { costMicros: number; impressions: number; clicks: number; conversions: number; conversionsValue: number };

const totalsOf = (row: Row): Totals => {
  const m = row.metrics ?? {};
  return {
    costMicros: num(m.costMicros),
    impressions: num(m.impressions),
    clicks: num(m.clicks),
    conversions: num(m.conversions),
    conversionsValue: num(m.conversionsValue),
  };
};

const fieldsOf = (t: Totals): MetricFields => ({
  ...deriveMetrics(t),
  impressions: t.impressions,
  clicks: t.clicks,
  conversions: t.conversions,
  conversionsValue: t.conversionsValue,
});

export type KeywordRow = MetricFields & {
  campaignId: string;
  campaign: string;
  adGroupId: string;
  adGroup: string;
  keyword: string;
  matchType: string | null;
  status: string | null;
  qualityScore: number | null;
};

export function mapKeywordRow(row: Row): KeywordRow {
  const criterion = row.adGroupCriterion ?? {};
  const keyword = (criterion.keyword ?? {}) as Record<string, unknown>;
  return {
    campaignId: String(row.campaign?.id ?? ""),
    campaign: text(row.campaign?.name) ?? "",
    adGroupId: String(row.adGroup?.id ?? ""),
    adGroup: text(row.adGroup?.name) ?? "",
    keyword: text(keyword.text) ?? "",
    matchType: text(keyword.matchType),
    status: text(criterion.status),
    qualityScore: fraction((criterion.qualityInfo as Record<string, unknown> | undefined)?.qualityScore),
    ...fieldsOf(totalsOf(row)),
  };
}

export type SearchTermRow = MetricFields & {
  term: string;
  status: string | null;
  keyword: string | null;
  matchType: string | null;
  campaignId: string;
  campaign: string;
  adGroupId: string;
  adGroup: string;
};

export function mapSearchTermRow(row: Row): SearchTermRow {
  const segmentKeyword = row.segments?.keyword as { info?: Record<string, unknown> } | undefined;
  return {
    term: maskPii(text(row.searchTermView?.searchTerm) ?? ""),
    status: text(row.searchTermView?.status),
    keyword: text(segmentKeyword?.info?.text),
    matchType: text(segmentKeyword?.info?.matchType),
    campaignId: String(row.campaign?.id ?? ""),
    campaign: text(row.campaign?.name) ?? "",
    adGroupId: String(row.adGroup?.id ?? ""),
    adGroup: text(row.adGroup?.name) ?? "",
    ...fieldsOf(totalsOf(row)),
  };
}

/** Soma as linhas do mesmo segmento (a API devolve uma por campanha ou grupo) e recalcula as taxas sobre o total. */
export function groupSegments<K extends string>(
  rows: readonly Row[],
  keyOf: (row: Row) => string | null,
  field: K,
): Array<Record<K, string> & MetricFields> {
  const byKey = new Map<string, Totals>();
  for (const row of rows) {
    const key = keyOf(row);
    if (key === null) continue;
    const t = totalsOf(row);
    const current = byKey.get(key) ?? { costMicros: 0, impressions: 0, clicks: 0, conversions: 0, conversionsValue: 0 };
    byKey.set(key, {
      costMicros: current.costMicros + t.costMicros,
      impressions: current.impressions + t.impressions,
      clicks: current.clicks + t.clicks,
      conversions: current.conversions + t.conversions,
      conversionsValue: current.conversionsValue + t.conversionsValue,
    });
  }
  return [...byKey.entries()]
    .map(([key, t]) => ({ [field]: key, ...fieldsOf(t) }) as Record<K, string> & MetricFields)
    .sort((a, b) => b.spend - a.spend);
}

export const deviceKey = (row: Row): string | null => text(row.segments?.device);
export const genderKey = (row: Row): string | null => text((row.adGroupCriterion?.gender as Record<string, unknown> | undefined)?.type);
export const ageKey = (row: Row): string | null => text((row.adGroupCriterion?.ageRange as Record<string, unknown> | undefined)?.type);

export function geoKey(row: Row, level: GeoLevel): string | null {
  const raw = level === "country" ? row.geographicView?.countryCriterionId : level === "region" ? row.segments?.geoTargetRegion : row.segments?.geoTargetCity;
  const value = text(typeof raw === "number" ? String(raw) : raw);
  if (!value) return null;
  return value.split("/").pop() ?? null;
}

export function applyGeoNames<T extends { geoId: string }>(rows: readonly T[], names: ReadonlyMap<string, string>): Array<T & { location: string }> {
  return rows.map((row) => ({ ...row, location: names.get(row.geoId) ?? `Local ${row.geoId}` }));
}

export type GeoNameRow = { id: string; name: string };

export function mapGeoName(row: Row): GeoNameRow | null {
  const c = row.geoTargetConstant;
  const id = c?.id === undefined ? null : String(c.id);
  const name = text(c?.canonicalName) ?? text(c?.name);
  return id && name ? { id, name } : null;
}

const SHARE_CHANNELS = new Set(["SEARCH", "SHOPPING"]);

export type VisibilityRow = {
  campaignId: string;
  campaign: string;
  channelType: string | null;
  impressions: number;
  spend: number;
  /** false quando o tipo de campanha não tem parcela de impressões na Pesquisa: mostrar "não aplicável". */
  shareApplicable: boolean;
  searchImpressionShare: number | null;
  budgetLostShare: number | null;
  rankLostShare: number | null;
  topImpressionPercentage: number | null;
  absoluteTopImpressionPercentage: number | null;
};

export function mapVisibilityRow(row: Row): VisibilityRow {
  const m = row.metrics ?? {};
  const channelType = text(row.campaign?.advertisingChannelType);
  const shareApplicable = channelType !== null && SHARE_CHANNELS.has(channelType);
  const share = (v: unknown) => (shareApplicable ? fraction(v) : null);
  return {
    campaignId: String(row.campaign?.id ?? ""),
    campaign: text(row.campaign?.name) ?? "",
    channelType,
    impressions: num(m.impressions),
    spend: num(m.costMicros) / 1_000_000,
    shareApplicable,
    searchImpressionShare: share(m.searchImpressionShare),
    budgetLostShare: share(m.searchBudgetLostImpressionShare),
    rankLostShare: share(m.searchRankLostImpressionShare),
    topImpressionPercentage: share(m.topImpressionPercentage),
    absoluteTopImpressionPercentage: share(m.absoluteTopImpressionPercentage),
  };
}
