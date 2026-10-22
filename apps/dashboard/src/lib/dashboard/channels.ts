// Comparativo Meta × Google × Total de um cliente no período (Visão geral "Meta + Google").
// Reaproveita os mesmos cálculos dos relatórios, para os números baterem entre as telas.

import { DEFAULT_RESULT_ACTION_TYPES } from "../reports/engine/insights-map";
import {
  aggregateDailyMetrics,
  aggregateGoogleRows,
  primaryResult,
  totalMetrics,
  type DailyMetricRow,
  type GoogleDailyRow,
} from "../reports/engine/metrics";

/** Nome do resultado principal da Meta (tipos já normalizados, como em meta_actions.*). */
const RESULT_LABELS: Readonly<Record<string, string>> = {
  purchase: "Compras",
  omni_purchase: "Compras",
  fb_pixel_purchase: "Compras",
  lead: "Cadastros",
  onsite_conversion_lead_grouped: "Cadastros",
  fb_pixel_lead: "Cadastros",
  onsite_conversion_messaging_conversation_started_7d: "Mensagens iniciadas",
  complete_registration: "Registros completos",
};

export type DatedMetaRow = DailyMetricRow & { date: string };
export type DatedGoogleRow = GoogleDailyRow & { date: string };

export type ChannelSummary = {
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  /** Receita atribuída (Meta) ou valor de conversões (Google). */
  value: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
  roas: number | null;
  /** Meta sem conversões na coluna: o que foi contado no lugar (ex.: "Mensagens iniciadas"). */
  resultLabel?: string;
};

export type ChannelOverview = {
  meta: ChannelSummary;
  google: ChannelSummary;
  total: ChannelSummary;
  daily: Array<{ date: string; meta: number; google: number }>;
  hasMeta: boolean;
  hasGoogle: boolean;
};

const MICROS = 1_000_000;

type Metrics = Readonly<Record<string, number>>;

const n = (m: Metrics, slug: string): number => m[slug] ?? 0;
const opt = (m: Metrics, slug: string): number | null => (m[slug] === undefined ? null : m[slug]);

function shiftDay(day: string, delta: number): string {
  const [y, mo, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d + delta)).toISOString().slice(0, 10);
}

function toNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function buildChannelOverview(
  metaRows: readonly DatedMetaRow[],
  googleRows: readonly DatedGoogleRow[],
  from: string,
  to: string,
): ChannelOverview {
  const meta = aggregateDailyMetrics(metaRows);
  const google = aggregateGoogleRows(googleRows);
  const total = totalMetrics({ ...meta, ...google });
  const metaValue = n(meta, "meta_spend") * n(meta, "meta_roas");
  const googleValue = n(google, "google_conversions_value");
  // Campanha de mensagem/cadastro não preenche a coluna de conversões; aí vale o resultado principal.
  const result = n(meta, "meta_conv") > 0 ? null : primaryResult(meta, DEFAULT_RESULT_ACTION_TYPES);
  const metaConversions = result ? result.value : n(meta, "meta_conv");

  const metaByDay = new Map<string, number>();
  for (const row of metaRows) metaByDay.set(row.date, (metaByDay.get(row.date) ?? 0) + toNumber(row.spend));
  const googleByDay = new Map<string, number>();
  for (const row of googleRows) googleByDay.set(row.date, (googleByDay.get(row.date) ?? 0) + toNumber(row.cost_micros) / MICROS);
  const daily: ChannelOverview["daily"] = [];
  for (let day = from; day <= to; day = shiftDay(day, 1)) {
    daily.push({ date: day, meta: metaByDay.get(day) ?? 0, google: googleByDay.get(day) ?? 0 });
  }

  return {
    meta: {
      spend: n(meta, "meta_spend"),
      impressions: n(meta, "meta_impressions"),
      clicks: n(meta, "meta_clicks"),
      conversions: metaConversions,
      value: metaValue,
      ctr: opt(meta, "meta_ctr"),
      cpc: opt(meta, "meta_cpc"),
      cpm: opt(meta, "meta_cpm"),
      roas: opt(meta, "meta_roas"),
      ...(result ? { resultLabel: RESULT_LABELS[result.type] ?? "Resultados" } : {}),
    },
    google: {
      spend: n(google, "google_spend"),
      impressions: n(google, "google_impressions"),
      clicks: n(google, "google_clicks"),
      conversions: n(google, "google_conversions"),
      value: googleValue,
      ctr: opt(google, "google_ctr"),
      cpc: opt(google, "google_cpc"),
      cpm: opt(google, "google_cpm"),
      roas: opt(google, "google_roas"),
    },
    total: {
      spend: n(total, "spend"),
      impressions: n(total, "impressions"),
      clicks: n(total, "clicks"),
      conversions: metaConversions + n(google, "google_conversions"),
      value: metaValue + googleValue,
      ctr: opt(total, "ctr"),
      cpc: opt(total, "cpc"),
      cpm: opt(total, "cpm"),
      roas: opt(total, "roas"),
    },
    daily,
    hasMeta: metaRows.length > 0,
    hasGoogle: googleRows.length > 0,
  };
}
