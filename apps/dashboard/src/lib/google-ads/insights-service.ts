// Busca ao vivo, no Google Ads, os dados das abas de análise de uma conta da organização.
// Só leitura. Nada é gravado no banco (termos de busca podem conter dados pessoais).

import type { SupabaseClient } from "@supabase/supabase-js";
import { searchAll } from "./client";
import { normalizeCustomerId } from "./gaql";
import {
  ageKey,
  ageQuery,
  applyGeoNames,
  deviceKey,
  deviceQuery,
  genderKey,
  genderQuery,
  geoKey,
  geoNamesQuery,
  geoQuery,
  groupSegments,
  keywordsDetailQuery,
  mapGeoName,
  mapKeywordRow,
  mapSearchTermRow,
  mapVisibilityRow,
  searchTermsQuery,
  visibilityQuery,
  type GeoLevel,
  type GeoLocationType,
} from "./insights-queries";
import { apiContext } from "./service";

export const INSIGHT_KINDS = ["keywords", "search_terms", "devices", "gender", "age", "locations", "visibility"] as const;
export type InsightKind = (typeof INSIGHT_KINDS)[number];

export type InsightParams = {
  orgId: string;
  accountId: string;
  kind: InsightKind;
  from: string;
  to: string;
  campaignId?: string;
  level: GeoLevel;
  locationType: GeoLocationType;
};

export type InsightResult = {
  kind: InsightKind;
  rows: Array<Record<string, unknown>>;
  fetchedAt: string;
  currency: string | null;
  /** Avisos que a tela mostra junto da tabela (limites do Google, tipos de campanha que ficam de fora). */
  notes: string[];
  /** true quando a API devolveu o máximo pedido: pode haver mais linhas além das mostradas. */
  truncated: boolean;
};

export class InsightInputError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 404,
  ) {
    super(message);
    this.name = "InsightInputError";
  }
}

const CACHE_TTL_MS = 5 * 60_000;
const CACHE_MAX_ENTRIES = 100;
const GEO_NAME_BATCH = 100;
const KEYWORD_LIMIT = 500;
const SEARCH_TERM_LIMIT = 500;
const GEO_LIMIT = 1000;

const cache = new Map<string, { expires: number; value: InsightResult }>();

function cacheKey(p: InsightParams): string {
  return [p.orgId, p.accountId, p.kind, p.from, p.to, p.campaignId ?? "", p.level, p.locationType].join("|");
}

function remember(key: string, value: InsightResult): void {
  if (cache.size >= CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
  cache.set(key, { expires: Date.now() + CACHE_TTL_MS, value });
}

type Db = SupabaseClient;
type ApiRow = Record<string, Record<string, unknown>>;

async function loadGeoNames(run: (query: string) => Promise<ApiRow[]>, ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  for (let i = 0; i < ids.length; i += GEO_NAME_BATCH) {
    for (const row of await run(geoNamesQuery(ids.slice(i, i + GEO_NAME_BATCH)))) {
      const parsed = mapGeoName(row);
      if (parsed) names.set(parsed.id, parsed.name);
    }
  }
  return names;
}

export async function fetchInsights(db: Db, params: InsightParams): Promise<InsightResult> {
  const { data: account } = await db
    .from("ad_accounts")
    .select("external_id, currency")
    .eq("org_id", params.orgId)
    .eq("id", params.accountId)
    .eq("platform", "google")
    .maybeSingle();
  const customerId = account ? normalizeCustomerId(String(account.external_id)) : null;
  if (!account || !customerId) throw new InsightInputError("Conta do Google Ads não encontrada", 404);

  const key = cacheKey(params);
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;

  const ctx = await apiContext(db, params.orgId);
  const options = { accessToken: ctx.accessToken, developerToken: ctx.developerToken, loginCustomerId: ctx.connection.login_customer_id ?? customerId };
  const run = (query: string) => searchAll(customerId, query, options);
  const range = { from: params.from, to: params.to, campaignId: params.campaignId };

  let rows: Array<Record<string, unknown>> = [];
  const notes: string[] = [];
  let truncated = false;

  switch (params.kind) {
    case "keywords": {
      const raw = await run(keywordsDetailQuery(range));
      rows = raw.map(mapKeywordRow);
      truncated = raw.length >= KEYWORD_LIMIT;
      break;
    }
    case "search_terms": {
      const raw = await run(searchTermsQuery(range));
      rows = raw.map(mapSearchTermRow);
      truncated = raw.length >= SEARCH_TERM_LIMIT;
      notes.push(
        "Só aparecem campanhas de Pesquisa e Shopping (Performance Max não entrega termos aqui).",
        "O Google oculta termos de pouco volume: a soma dos termos não fecha com o total da campanha.",
        "E-mails e telefones digitados nas pesquisas aparecem ocultos.",
      );
      break;
    }
    case "devices": {
      rows = groupSegments(await run(deviceQuery(range)), deviceKey, "device");
      break;
    }
    case "gender": {
      rows = groupSegments(await run(genderQuery(range)), genderKey, "gender");
      notes.push("Sexo só existe em campanhas de Pesquisa, Display e Vídeo; Performance Max não entrega. \"Indeterminado\" é quem o Google não conseguiu classificar.");
      break;
    }
    case "age": {
      rows = groupSegments(await run(ageQuery(range)), ageKey, "age");
      notes.push("Faixa etária só existe em campanhas de Pesquisa, Display e Vídeo; Performance Max não entrega.");
      break;
    }
    case "locations": {
      const raw = await run(geoQuery({ ...range, level: params.level, locationType: params.locationType }));
      truncated = raw.length >= GEO_LIMIT;
      const grouped = groupSegments(raw, (r) => geoKey(r, params.level), "geoId");
      try {
        const names = await loadGeoNames(run, grouped.map((g) => g.geoId));
        rows = applyGeoNames(grouped, names);
      } catch {
        rows = applyGeoNames(grouped, new Map());
        notes.push("Não foi possível buscar os nomes das localidades agora; mostrando o código de cada uma.");
      }
      notes.push(
        params.locationType === "presence"
          ? "Mostrando onde as pessoas estavam fisicamente. A visão por interesse (onde procuraram) é outra e não se soma a esta."
          : "Mostrando o local de interesse (onde as pessoas procuraram). Não se soma à visão por presença.",
      );
      break;
    }
    case "visibility": {
      rows = (await run(visibilityQuery(range))).map(mapVisibilityRow);
      notes.push("Parcela de impressões só existe em campanhas de Pesquisa e Shopping; nos outros tipos aparece como não aplicável.");
      break;
    }
  }

  if (truncated) notes.unshift("Mostrando as linhas com maior gasto; existem mais além do limite da consulta.");
  const value: InsightResult = {
    kind: params.kind,
    rows,
    fetchedAt: new Date().toISOString(),
    currency: typeof account.currency === "string" ? account.currency : null,
    notes,
    truncated,
  };
  remember(key, value);
  return value;
}
