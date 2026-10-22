// Colunas, rótulos em português e ordenação padrão de cada aba de análise do Google Ads.

import { formatDecimal, formatInteger, formatMoney, formatRate, formatRatio } from "@/lib/format";
import type { InsightKind } from "@/lib/google-ads/insights-core";

export type RowData = Record<string, unknown>;
export type DeltaSense = "good" | "bad" | "neutral";

export type InsightColumn = {
  key: string;
  label: string;
  numeric?: boolean;
  /** Texto mostrado na célula. */
  text: (row: RowData, currency: string) => string;
  /** Valor gravado no CSV; por padrão o valor bruto do campo. */
  csv?: (row: RowData, currency: string) => unknown;
  /** Quando definido, a comparação com o período anterior aparece abaixo do valor. */
  delta?: DeltaSense;
};

export type KindConfig = {
  title: string;
  columns: InsightColumn[];
  defaultSort: { key: string; direction: "asc" | "desc" };
  searchFields: string[];
  rowKey: (row: RowData) => string;
  emptyMessage: string;
  fileName: string;
};

const DASH = "—";
const num = (row: RowData, key: string): number | null => {
  const v = row[key];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
};

const str = (key: string, label: string, map?: Record<string, string>): InsightColumn => ({
  key,
  label,
  text: (row) => {
    const v = row[key];
    if (typeof v !== "string" || v === "") return DASH;
    return map?.[v] ?? v;
  },
  csv: (row) => {
    const v = row[key];
    return typeof v === "string" ? (map?.[v] ?? v) : "";
  },
});

const metric = (
  key: string,
  label: string,
  format: (v: number, currency: string) => string,
  delta?: DeltaSense,
): InsightColumn => ({
  key,
  label,
  numeric: true,
  delta,
  text: (row, currency) => {
    const v = num(row, key);
    return v === null ? DASH : format(v, currency);
  },
});

const conversionsFormat = (v: number) => formatDecimal(v, v % 1 === 0 ? 0 : 1);

const METRIC_COLUMNS: InsightColumn[] = [
  metric("impressions", "Impressões", (v) => formatInteger(v)),
  metric("clicks", "Cliques", (v) => formatInteger(v)),
  metric("ctr", "CTR", (v) => formatRate(v)),
  metric("cpc", "CPC médio", (v, c) => formatMoney(v, c), "bad"),
  metric("spend", "Custo", (v, c) => formatMoney(v, c), "neutral"),
  metric("conversions", "Conversões", conversionsFormat, "good"),
  metric("conversionRate", "Taxa de conv.", (v) => formatRate(v), "good"),
  metric("cpa", "CPA", (v, c) => formatMoney(v, c), "bad"),
];

const roasColumn: InsightColumn = {
  ...metric("roas", "ROAS", (v) => formatRatio(v), "good"),
  text: (row) => {
    const value = num(row, "conversionsValue");
    const roas = num(row, "roas");
    return roas === null || !value ? DASH : formatRatio(roas);
  },
};

const MATCH_TYPE: Record<string, string> = { EXACT: "Exata", PHRASE: "Frase", BROAD: "Ampla" };
const KEYWORD_STATUS: Record<string, string> = { ENABLED: "Ativa", PAUSED: "Pausada", REMOVED: "Removida" };
const TERM_STATUS: Record<string, string> = {
  ADDED: "Já é palavra-chave",
  EXCLUDED: "Negativado",
  ADDED_EXCLUDED: "Palavra-chave e negativo",
  NONE: "Nenhum",
};
export const DEVICE_LABEL: Record<string, string> = {
  MOBILE: "Celular",
  DESKTOP: "Computador",
  TABLET: "Tablet",
  CONNECTED_TV: "TV conectada",
  OTHER: "Outros",
  UNKNOWN: "Desconhecido",
  UNSPECIFIED: "Não especificado",
};
export const GENDER_LABEL: Record<string, string> = { MALE: "Masculino", FEMALE: "Feminino", UNDETERMINED: "Indeterminado", UNKNOWN: "Desconhecido" };
const CHANNEL: Record<string, string> = {
  SEARCH: "Pesquisa",
  DISPLAY: "Display",
  SHOPPING: "Shopping",
  VIDEO: "Vídeo",
  PERFORMANCE_MAX: "Performance Max",
  DEMAND_GEN: "Demand Gen",
  MULTI_CHANNEL: "App",
  LOCAL: "Local",
  SMART: "Inteligente",
};

export function ageLabel(value: string): string {
  if (value === "AGE_RANGE_UNDETERMINED") return "Indeterminado";
  const upTo = /^AGE_RANGE_(\d+)_UP$/.exec(value);
  if (upTo) return `${upTo[1]}+`;
  const range = /^AGE_RANGE_(\d+)_(\d+)$/.exec(value);
  return range ? `${range[1]} a ${range[2]}` : value;
}

const AGE_ORDER = ["AGE_RANGE_18_24", "AGE_RANGE_25_34", "AGE_RANGE_35_44", "AGE_RANGE_45_54", "AGE_RANGE_55_64", "AGE_RANGE_65_UP", "AGE_RANGE_UNDETERMINED"];

const percent = (key: string, label: string): InsightColumn => ({
  key,
  label,
  numeric: true,
  text: (row) => {
    const v = num(row, key);
    return v === null ? DASH : formatRate(v * 100, v < 0.1 && v > 0 ? 1 : 0);
  },
  csv: (row) => {
    const v = num(row, key);
    return v === null ? null : Math.round(v * 10000) / 100;
  },
});

/** Parcelas ficam "Não aplicável" quando o tipo da campanha não as tem, e "Não disponível" quando o Google não informou. */
const share = (key: string, label: string): InsightColumn => {
  const base = percent(key, label);
  return {
    ...base,
    text: (row, currency) => (row.shareApplicable === false ? "Não aplicável" : num(row, key) === null ? "Não disponível" : base.text(row, currency)),
    csv: (row, currency) => (row.shareApplicable === false ? "Não aplicável" : num(row, key) === null ? "Não disponível" : base.csv?.(row, currency)),
  };
};

export const KIND_CONFIG: Record<InsightKind, KindConfig> = {
  keywords: {
    title: "Palavras-chave",
    fileName: "google-ads-palavras-chave",
    emptyMessage: "Nenhuma palavra-chave com impressões neste período.",
    defaultSort: { key: "spend", direction: "desc" },
    searchFields: ["keyword", "campaign", "adGroup"],
    rowKey: (r) => `${r.campaignId}|${r.adGroupId}|${r.keyword}|${r.matchType}`,
    columns: [
      str("keyword", "Palavra-chave"),
      str("matchType", "Correspondência", MATCH_TYPE),
      str("campaign", "Campanha"),
      str("adGroup", "Grupo de anúncios"),
      str("status", "Status", KEYWORD_STATUS),
      metric("qualityScore", "Índice de qualidade", (v) => formatDecimal(v, 0)),
      ...METRIC_COLUMNS,
      roasColumn,
    ],
  },
  search_terms: {
    title: "Termos de pesquisa",
    fileName: "google-ads-termos-de-pesquisa",
    emptyMessage: "Nenhum termo de pesquisa com impressões neste período (só campanhas de Pesquisa e Shopping entregam termos).",
    defaultSort: { key: "spend", direction: "desc" },
    searchFields: ["term", "keyword", "campaign", "adGroup"],
    rowKey: (r) => `${r.term}|${r.campaignId}|${r.adGroupId}|${r.keyword}|${r.matchType}`,
    columns: [
      str("term", "Termo de pesquisa"),
      str("keyword", "Palavra-chave que acionou"),
      str("matchType", "Correspondência", MATCH_TYPE),
      str("campaign", "Campanha"),
      str("adGroup", "Grupo de anúncios"),
      str("status", "Situação", TERM_STATUS),
      ...METRIC_COLUMNS,
    ],
  },
  devices: {
    title: "Dispositivos",
    fileName: "google-ads-dispositivos",
    emptyMessage: "Sem dados de dispositivo neste período.",
    defaultSort: { key: "spend", direction: "desc" },
    searchFields: ["device"],
    rowKey: (r) => String(r.device),
    columns: [str("device", "Dispositivo", DEVICE_LABEL), ...METRIC_COLUMNS, roasColumn],
  },
  gender: {
    title: "Sexo",
    fileName: "google-ads-sexo",
    emptyMessage: "Sem dados demográficos de sexo neste período.",
    defaultSort: { key: "spend", direction: "desc" },
    searchFields: ["gender"],
    rowKey: (r) => String(r.gender),
    columns: [str("gender", "Sexo", GENDER_LABEL), ...METRIC_COLUMNS],
  },
  age: {
    title: "Faixa etária",
    fileName: "google-ads-faixa-etaria",
    emptyMessage: "Sem dados demográficos de idade neste período.",
    defaultSort: { key: "ageOrder", direction: "asc" },
    searchFields: ["age"],
    rowKey: (r) => String(r.age),
    columns: [
      {
        key: "age",
        label: "Faixa etária",
        text: (row) => ageLabel(String(row.age ?? "")),
        csv: (row) => ageLabel(String(row.age ?? "")),
      },
      ...METRIC_COLUMNS,
    ],
  },
  locations: {
    title: "Localidades",
    fileName: "google-ads-localidades",
    emptyMessage: "Sem dados de localidade neste período.",
    defaultSort: { key: "spend", direction: "desc" },
    searchFields: ["location"],
    rowKey: (r) => String(r.geoId),
    columns: [str("location", "Localidade"), ...METRIC_COLUMNS, roasColumn],
  },
  visibility: {
    title: "Visibilidade",
    fileName: "google-ads-visibilidade",
    emptyMessage: "Sem campanhas com impressões neste período.",
    defaultSort: { key: "spend", direction: "desc" },
    searchFields: ["campaign"],
    rowKey: (r) => String(r.campaignId),
    columns: [
      str("campaign", "Campanha"),
      str("channelType", "Tipo", CHANNEL),
      metric("impressions", "Impressões", (v) => formatInteger(v)),
      metric("spend", "Custo", (v, c) => formatMoney(v, c), "neutral"),
      share("searchImpressionShare", "Parcela de impressões"),
      share("budgetLostShare", "Perdida por orçamento"),
      share("rankLostShare", "Perdida por classificação"),
      share("topImpressionPercentage", "Topo da página"),
      share("absoluteTopImpressionPercentage", "Primeira posição"),
    ],
  },
};

/** Ordem natural das faixas etárias (o Google devolve texto; ordenar como texto embaralharia 65+ e 18-24). */
export function withAgeOrder<T extends RowData>(rows: readonly T[]): Array<T & { ageOrder: number }> {
  return rows.map((row) => {
    const index = AGE_ORDER.indexOf(String(row.age));
    return { ...row, ageOrder: index === -1 ? AGE_ORDER.length : index };
  });
}
