// Google Ads API (REST): consultas GAQL, leitura das respostas e indicadores. Módulo puro.
// Na resposta JSON, int64 vem como texto e campos com valor padrão (0, false) podem faltar.

export const GOOGLE_ADS_API_VERSION = "v26";

const CUSTOMER_ID = /^\d{10}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeCustomerId(value: string): string | null {
  const digits = value.trim().replace(/-/g, "");
  return CUSTOMER_ID.test(digits) ? digits : null;
}

export function formatCustomerId(id: string): string {
  return CUSTOMER_ID.test(id) ? `${id.slice(0, 3)}-${id.slice(3, 6)}-${id.slice(6)}` : id;
}

function assertDay(day: string): string {
  if (!DAY.test(day)) throw new Error(`data inválida: ${day}`);
  return day;
}

export function accountsQuery(): string {
  return [
    "SELECT customer_client.id, customer_client.descriptive_name, customer_client.currency_code,",
    "customer_client.time_zone, customer_client.manager, customer_client.status, customer_client.level",
    "FROM customer_client WHERE customer_client.level <= 1",
  ].join(" ");
}

export function campaignsQuery(): string {
  return [
    "SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,",
    "campaign.advertising_channel_sub_type, campaign.bidding_strategy_type,",
    "campaign_budget.amount_micros, campaign_budget.period",
    "FROM campaign WHERE campaign.status != 'REMOVED'",
  ].join(" ");
}

export function dailyMetricsQuery(from: string, to: string): string {
  return [
    "SELECT campaign.id, segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks,",
    "metrics.conversions, metrics.conversions_value",
    `FROM campaign WHERE segments.date BETWEEN '${assertDay(from)}' AND '${assertDay(to)}'`,
  ].join(" ");
}

/**
 * Métricas que a v26 só devolve para parte das campanhas (parcela de impressões só na Pesquisa/Display,
 * vídeo só em campanhas de vídeo). Fica numa consulta separada para que um campo recusado nunca
 * derrube a sincronização principal.
 */
export function extraMetricsQuery(from: string, to: string): string {
  return [
    "SELECT campaign.id, segments.date, metrics.interactions, metrics.all_conversions, metrics.all_conversions_value,",
    "metrics.search_impression_share, metrics.search_budget_lost_impression_share,",
    "metrics.search_rank_lost_impression_share, metrics.content_budget_lost_impression_share,",
    "metrics.top_impression_percentage, metrics.absolute_top_impression_percentage,",
    "metrics.video_trueview_views, metrics.video_trueview_view_rate",
    `FROM campaign WHERE segments.date BETWEEN '${assertDay(from)}' AND '${assertDay(to)}' AND metrics.impressions > 0`,
  ].join(" ");
}

const KEYWORD_ROWS_LIMIT = 1000;

/** Palavras-chave com impressão no período, as mais vistas primeiro (base do ranking e do índice de qualidade). */
export function keywordsQuery(from: string, to: string): string {
  return [
    "SELECT ad_group_criterion.keyword.text, ad_group_criterion.quality_info.quality_score,",
    "metrics.impressions, metrics.clicks, metrics.conversions, metrics.cost_micros",
    `FROM keyword_view WHERE segments.date BETWEEN '${assertDay(from)}' AND '${assertDay(to)}' AND metrics.impressions > 0`,
    `ORDER BY metrics.impressions DESC LIMIT ${KEYWORD_ROWS_LIMIT}`,
  ].join(" ");
}

type Row = Record<string, Record<string, unknown> | undefined>;

const text = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
const num = (v: unknown): number => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : 0;
  return Number.isFinite(n) ? n : 0;
};

export type GoogleAdsAccount = {
  customerId: string;
  name: string;
  currency: string | null;
  timeZone: string | null;
  manager: boolean;
  status: string | null;
  level: number;
};

export function mapCustomerClient(row: Row): GoogleAdsAccount {
  const c = row.customerClient ?? {};
  const customerId = String(c.id ?? "");
  return {
    customerId,
    name: text(c.descriptiveName) ?? `Conta ${formatCustomerId(customerId)}`,
    currency: text(c.currencyCode),
    timeZone: text(c.timeZone),
    manager: c.manager === true,
    status: text(c.status),
    level: num(c.level),
  };
}

export type GoogleAdsCampaign = {
  campaignId: string;
  name: string;
  status: string | null;
  channelType: string | null;
  channelSubType: string | null;
  biddingStrategyType: string | null;
  budgetMicros: number | null;
  budgetPeriod: string | null;
};

export function mapCampaign(row: Row): GoogleAdsCampaign {
  const c = row.campaign ?? {};
  const b = row.campaignBudget;
  return {
    campaignId: String(c.id ?? ""),
    name: text(c.name) ?? String(c.id ?? ""),
    status: text(c.status),
    channelType: text(c.advertisingChannelType),
    channelSubType: text(c.advertisingChannelSubType),
    biddingStrategyType: text(c.biddingStrategyType),
    budgetMicros: b ? num(b.amountMicros) : null,
    budgetPeriod: b ? text(b.period) : null,
  };
}

export type GoogleAdsDailyMetric = {
  campaignId: string;
  date: string;
  costMicros: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionsValue: number;
};

export function mapDailyMetric(row: Row): GoogleAdsDailyMetric {
  const m = row.metrics ?? {};
  return {
    campaignId: String(row.campaign?.id ?? ""),
    date: String(row.segments?.date ?? ""),
    costMicros: num(m.costMicros),
    impressions: num(m.impressions),
    clicks: num(m.clicks),
    conversions: num(m.conversions),
    conversionsValue: num(m.conversionsValue),
  };
}

export type GoogleAdsExtraMetric = {
  campaignId: string;
  date: string;
  interactions: number;
  allConversions: number;
  allConversionsValue: number;
  /** Frações de 0 a 1; null quando a API não informa para a campanha. */
  searchImpressionShare: number | null;
  searchBudgetLostImpressionShare: number | null;
  searchRankLostImpressionShare: number | null;
  contentBudgetLostImpressionShare: number | null;
  topImpressionPercentage: number | null;
  absoluteTopImpressionPercentage: number | null;
  videoViews: number;
  videoViewRate: number | null;
};

const fraction = (v: unknown): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

export function mapExtraMetric(row: Row): GoogleAdsExtraMetric {
  const m = row.metrics ?? {};
  return {
    campaignId: String(row.campaign?.id ?? ""),
    date: String(row.segments?.date ?? ""),
    interactions: num(m.interactions),
    allConversions: num(m.allConversions),
    allConversionsValue: num(m.allConversionsValue),
    searchImpressionShare: fraction(m.searchImpressionShare),
    searchBudgetLostImpressionShare: fraction(m.searchBudgetLostImpressionShare),
    searchRankLostImpressionShare: fraction(m.searchRankLostImpressionShare),
    contentBudgetLostImpressionShare: fraction(m.contentBudgetLostImpressionShare),
    topImpressionPercentage: fraction(m.topImpressionPercentage),
    absoluteTopImpressionPercentage: fraction(m.absoluteTopImpressionPercentage),
    videoViews: num(m.videoTrueviewViews),
    videoViewRate: fraction(m.videoTrueviewViewRate),
  };
}

export type KeywordRanking = {
  keyword: string;
  conversions: number;
  clicks: number;
  cost: number;
  costPerConversion: number | null;
};

export type KeywordSummary = { ranking: KeywordRanking[]; qualityScore: number | null };

/** Junta a mesma palavra de grupos diferentes; índice de qualidade = média ponderada pelas impressões. */
export function summarizeKeywords(rows: readonly Row[], limit: number): KeywordSummary {
  const byText = new Map<string, { conversions: number; clicks: number; costMicros: number }>();
  let weighted = 0;
  let weight = 0;
  for (const row of rows) {
    const criterion = row.adGroupCriterion ?? {};
    const keyword = text((criterion.keyword as Record<string, unknown> | undefined)?.text);
    if (!keyword) continue;
    const m = row.metrics ?? {};
    const current = byText.get(keyword) ?? { conversions: 0, clicks: 0, costMicros: 0 };
    byText.set(keyword, {
      conversions: current.conversions + num(m.conversions),
      clicks: current.clicks + num(m.clicks),
      costMicros: current.costMicros + num(m.costMicros),
    });
    const quality = fraction((criterion.qualityInfo as Record<string, unknown> | undefined)?.qualityScore);
    if (quality !== null) {
      weighted += quality * num(m.impressions);
      weight += num(m.impressions);
    }
  }
  const ranking = [...byText.entries()]
    .map(([keyword, t]) => {
      const cost = t.costMicros / 1_000_000;
      return { keyword, conversions: t.conversions, clicks: t.clicks, cost, costPerConversion: t.conversions > 0 ? cost / t.conversions : null };
    })
    .sort((a, b) => b.conversions - a.conversions || b.clicks - a.clicks)
    .slice(0, limit);
  return { ranking, qualityScore: weight > 0 ? weighted / weight : null };
}

export type MetricTotals = Pick<GoogleAdsDailyMetric, "costMicros" | "impressions" | "clicks" | "conversions" | "conversionsValue">;

export type MetricSummary = {
  spend: number;
  impressions: number;
  clicks: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  conversions: number;
  costPerConversion: number | null;
  conversionRate: number | null;
  conversionsValue: number;
  roas: number | null;
};

const ratio = (a: number, b: number, factor = 1): number | null => (b > 0 ? (a / b) * factor : null);

export function summarizeMetrics(rows: readonly MetricTotals[]): MetricSummary {
  const t = rows.reduce(
    (acc, r) => ({
      cost: acc.cost + r.costMicros,
      impressions: acc.impressions + r.impressions,
      clicks: acc.clicks + r.clicks,
      conversions: acc.conversions + r.conversions,
      value: acc.value + r.conversionsValue,
    }),
    { cost: 0, impressions: 0, clicks: 0, conversions: 0, value: 0 },
  );
  const spend = t.cost / 1_000_000;
  return {
    spend,
    impressions: t.impressions,
    clicks: t.clicks,
    ctr: ratio(t.clicks, t.impressions, 100),
    cpc: ratio(spend, t.clicks),
    cpm: ratio(spend, t.impressions, 1000),
    conversions: t.conversions,
    costPerConversion: ratio(spend, t.conversions),
    conversionRate: ratio(t.conversions, t.clicks, 100),
    conversionsValue: t.value,
    roas: ratio(t.value, spend),
  };
}

export type GoogleAdsErrorKind = "developer_token_not_approved" | "no_access" | "auth" | "quota" | "invalid_request" | "error";

export type GoogleAdsErrorInfo = { kind: GoogleAdsErrorKind; message: string; code: string | null };

type ErrorBody = {
  error?: {
    status?: string;
    message?: string;
    details?: Array<{ errors?: Array<{ errorCode?: Record<string, string>; message?: string }> }>;
  };
} | null;

export function parseGoogleAdsError(httpStatus: number, body: ErrorBody): GoogleAdsErrorInfo {
  const first = body?.error?.details?.flatMap((d) => d.errors ?? [])[0];
  const code = first?.errorCode ? Object.values(first.errorCode)[0] ?? null : null;
  const message = first?.message ?? body?.error?.message ?? `Google Ads respondeu ${httpStatus}`;

  if (code === "DEVELOPER_TOKEN_NOT_APPROVED" || code === "DEVELOPER_TOKEN_PROHIBITED") {
    return { kind: "developer_token_not_approved", message, code };
  }
  if (code === "USER_PERMISSION_DENIED" || code === "CUSTOMER_NOT_ENABLED" || code === "NOT_ADS_USER") {
    return { kind: "no_access", message, code };
  }
  if (httpStatus === 401 || body?.error?.status === "UNAUTHENTICATED") return { kind: "auth", message, code };
  if (httpStatus === 429 || body?.error?.status === "RESOURCE_EXHAUSTED") return { kind: "quota", message, code };
  if (httpStatus === 400) return { kind: "invalid_request", message, code };
  return { kind: "error", message, code };
}
