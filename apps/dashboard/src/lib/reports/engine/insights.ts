import "server-only";

import {
  ACCOUNT_INSIGHT_FIELDS,
  AD_INSIGHT_FIELDS,
  describeGraphError,
  mapAccountInsightRow,
  rankAds,
  type AccountInsightRow,
  type AdInsightRow,
  type GraphError,
} from "./insights-map";
import type { MetricValues } from "./metrics";
import type { CreativeRow } from "./render";

export interface InsightsRange {
  accountId: string;
  token: string;
  since: string;
  until: string;
}

export interface TopCreativesQuery extends InsightsRange {
  limit?: number;
  resultActionTypes?: readonly string[];
}

interface GraphList<T> {
  data?: T[];
  paging?: { next?: string };
}

interface AdCreativeLink {
  creative?: { instagram_permalink_url?: string };
}

const GRAPH_TIMEOUT_MS = 15_000;
const AD_PAGE_SIZE = 500;
const MAX_AD_PAGES = 5;
const DEFAULT_CREATIVE_LIMIT = 10;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class MetaInsightsError extends Error {
  constructor(
    message: string,
    readonly code: number | null,
  ) {
    super(message);
    this.name = "MetaInsightsError";
  }

  get tokenExpired(): boolean {
    return this.code === 190;
  }
}

function graphBaseUrl(): string {
  return `https://graph.facebook.com/${process.env.META_GRAPH_API_VERSION || "v21.0"}`;
}

const META_ACCOUNT_ID = /^(?:act_)?(\d+)$/;

function accountPath(accountId: string): string {
  const match = META_ACCOUNT_ID.exec(accountId);
  if (!match) throw new MetaInsightsError(`ID de conta Meta inválido: ${accountId}`, null);
  return `act_${match[1]}`;
}

function graphUrl(path: string, token: string, params: Readonly<Record<string, string>>): string {
  const url = new URL(`${graphBaseUrl()}/${path}`);
  for (const [key, value] of Object.entries({ ...params, access_token: token })) url.searchParams.set(key, value);
  return url.toString();
}

function assertRange(range: InsightsRange): void {
  if (!range.token) throw new MetaInsightsError("Sem token da Meta para esta conta. Reconecte em Configurações > Meta Ads.", null);
  if (!ISO_DATE.test(range.since) || !ISO_DATE.test(range.until)) {
    throw new MetaInsightsError(`Período inválido: ${range.since} a ${range.until} (use AAAA-MM-DD).`, null);
  }
}

function networkMessage(err: unknown): string {
  if (err instanceof Error && err.name === "TimeoutError") return `A Meta não respondeu em ${GRAPH_TIMEOUT_MS / 1000}s.`;
  return `Falha de rede ao consultar a Meta: ${err instanceof Error ? err.message : String(err)}`;
}

async function fetchGraph(url: string): Promise<Response> {
  try {
    return await fetch(url, { signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS) });
  } catch (err) {
    throw new MetaInsightsError(networkMessage(err), null);
  }
}

async function graphGet<T>(url: string): Promise<T> {
  const res = await fetchGraph(url);
  const body = (await res.json().catch(() => null)) as (T & { error?: GraphError }) | null;
  if (!body) throw new MetaInsightsError(`A Meta devolveu uma resposta inválida (HTTP ${res.status}).`, null);
  if (body.error || !res.ok) {
    const error = body.error ?? { code: res.status, message: `HTTP ${res.status}` };
    throw new MetaInsightsError(describeGraphError(error), error.code ?? res.status);
  }
  return body;
}

function timeRange(range: InsightsRange): string {
  return JSON.stringify({ since: range.since, until: range.until });
}

export async function fetchAccountInsightMetrics(range: InsightsRange): Promise<MetricValues> {
  assertRange(range);
  const url = graphUrl(`${accountPath(range.accountId)}/insights`, range.token, {
    level: "account",
    fields: ACCOUNT_INSIGHT_FIELDS.join(","),
    time_range: timeRange(range),
  });
  const body = await graphGet<GraphList<AccountInsightRow>>(url);
  return mapAccountInsightRow(body.data?.[0]);
}

async function fetchAdInsightRows(range: InsightsRange): Promise<AdInsightRow[]> {
  const first = graphUrl(`${accountPath(range.accountId)}/insights`, range.token, {
    level: "ad",
    fields: AD_INSIGHT_FIELDS.join(","),
    time_range: timeRange(range),
    limit: String(AD_PAGE_SIZE),
  });
  const rows: AdInsightRow[] = [];
  let next: string | undefined = first;
  for (let page = 0; next && page < MAX_AD_PAGES; page++) {
    const body: GraphList<AdInsightRow> = await graphGet<GraphList<AdInsightRow>>(next);
    rows.push(...(body.data ?? []));
    next = body.paging?.next;
  }
  return rows;
}

async function fetchPermalinks(adIds: readonly string[], token: string): Promise<Record<string, string>> {
  if (adIds.length === 0) return {};
  const url = graphUrl("", token, { ids: adIds.join(","), fields: "creative{instagram_permalink_url}" });
  const body = await graphGet<Record<string, AdCreativeLink>>(url);
  const links = adIds.map((id) => [id, body[id]?.creative?.instagram_permalink_url] as const);
  return Object.fromEntries(links.filter((l): l is readonly [string, string] => Boolean(l[1])));
}

export async function fetchTopCreatives(query: TopCreativesQuery): Promise<CreativeRow[]> {
  assertRange(query);
  const rows = await fetchAdInsightRows(query);
  const ranked = rankAds(rows, { limit: query.limit ?? DEFAULT_CREATIVE_LIMIT, resultActionTypes: query.resultActionTypes });
  const urls = await fetchPermalinks(ranked.map((ad) => ad.adId), query.token);
  return ranked.map(({ adId, creative }) => (urls[adId] ? { ...creative, url: urls[adId] } : creative));
}
