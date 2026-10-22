import { VARIABLE_BY_SLUG } from "./catalog";
import type { VariableReturnType } from "./types";

// preview: editor/pré-visualização, pode usar valores de exemplo.
// live: relatório real, nunca inventa número; o que faltar vira "—" e entra em `missing`.
export type RenderMode = "preview" | "live";

export interface CreativeRow {
  name: string;
  results: number;
  cpa: number;
  ctr: number;
  url?: string;
}

export interface RenderContext {
  clientName?: string;
  startDate?: string;
  endDate?: string;
  dashboardUrl?: string;
  metrics?: Readonly<Record<string, number | string>>;
  texts?: Readonly<Record<string, string>>;
  creatives?: readonly CreativeRow[];
  currency?: string;
  timezone?: string;
  now?: Date;
  maskRealValues?: boolean;
}

export interface RenderResult {
  text: string;
  missing: string[];
}

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;
const EMPTY = "—";
const DEFAULT_TIMEZONE = "America/Sao_Paulo";
const MEDALS = ["🥇 1.", "🥈 2.", "🥉 3."];

const RANKING_LIMITS: Readonly<Record<string, number>> = {
  meta_top_1_creatives_ranking: 1,
  meta_top_3_creatives_ranking: 3,
  meta_top_5_creatives_ranking: 5,
  meta_all_creatives_ranking: 10,
};

const SIMPLE_RANKING_LIMITS: Readonly<Record<string, number>> = {
  meta_all_creatives_simple: 10,
};

const MASKS: Partial<Record<VariableReturnType, string>> = {
  currency: "R$ •••••",
  percent: "••,•%",
  number: "•••••",
};

const DEMO_CREATIVES: readonly CreativeRow[] = [
  { name: "[CJ_01][CP_01] Criativo Campeão (Vídeo)", results: 142, cpa: 12.4, ctr: 2.15, url: "https://instagram.com/p/exemplo-1" },
  { name: "[CJ_02][CP_01] Carrossel de Depoimentos", results: 88, cpa: 16.8, ctr: 1.82, url: "https://instagram.com/p/exemplo-2" },
  { name: "[CJ_01][CP_02] Imagem Estática - Oferta Direta", results: 54, cpa: 19.1, ctr: 1.35, url: "https://instagram.com/p/exemplo-3" },
  { name: "[CJ_03][CP_01] Reels - Bastidores", results: 41, cpa: 21.7, ctr: 1.12, url: "https://instagram.com/p/exemplo-4" },
  { name: "[CJ_02][CP_03] Story - Cupom", results: 29, cpa: 24.3, ctr: 0.98, url: "https://instagram.com/p/exemplo-5" },
];

function toNumber(value: number | string): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatCurrency(value: number, currency = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);
}

export function formatPercent(value: number): string {
  return `${new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}%`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 }).format(value);
}

function formatMetric(value: number | string, returns: VariableReturnType, currency?: string): string {
  if (returns !== "currency" && returns !== "percent" && returns !== "number") return String(value);
  const num = toNumber(value);
  if (num === null) return String(value);
  if (returns === "currency") return formatCurrency(num, currency);
  if (returns === "percent") return formatPercent(num);
  return formatNumber(num);
}

export function formatCreativeRanking(creatives: readonly CreativeRow[], limit: number, currency?: string): string {
  return creatives
    .slice(0, limit)
    .map((c, i) => {
      const lines = [
        `${MEDALS[i] ?? `${i + 1}.`} ${c.name}`,
        `Resultados: ${formatNumber(c.results)} | CPA: ${formatCurrency(c.cpa, currency)} | CTR: ${formatPercent(c.ctr)}`,
      ];
      if (c.url) lines.push(`🔗 ${c.url}`);
      return lines.join("\n");
    })
    .join("\n\n");
}

export function formatCreativeSimple(creatives: readonly CreativeRow[], limit: number): string {
  return creatives
    .slice(0, limit)
    .map((c, i) => `${MEDALS[i] ?? `${i + 1}.`} ${c.name}`)
    .join("\n");
}

const pad2 = (n: number): string => String(n).padStart(2, "0");

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function monthName(month: number): string {
  const date = new Date(Date.UTC(2000, month - 1, 1));
  return capitalize(date.toLocaleString("pt-BR", { month: "long", timeZone: "UTC" }));
}

function greetingFor(hour: number): string {
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

// Variáveis de calendário calculadas no fuso do relatório, não no do servidor
function clockValues(now: Date, timeZone: string): Record<string, string> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.find((p) => p.type === type)?.value);

  const year = part("year");
  const month = part("month");
  const day = part("day");
  const hour = part("hour");
  const yesterday = new Date(Date.UTC(year, month - 1, day - 1));

  return {
    greeting: greetingFor(hour),
    current_day: pad2(day),
    current_month: monthName(month),
    current_year: String(year),
    current_hour: `${pad2(hour)}:${pad2(part("minute"))}`,
    yesterday: `${pad2(yesterday.getUTCDate())}/${pad2(yesterday.getUTCMonth() + 1)}/${yesterday.getUTCFullYear()}`,
    previous_month: monthName(month === 1 ? 12 : month - 1),
  };
}

function contextTexts(ctx: RenderContext): Record<string, string> {
  const entries: Array<[string, string | undefined]> = [
    ["client_name", ctx.clientName],
    ["start_date", ctx.startDate],
    ["end_date", ctx.endDate],
    ["client_dashboard_url", ctx.dashboardUrl],
    ...Object.entries(ctx.texts ?? {}),
  ];
  return Object.fromEntries(entries.filter((e): e is [string, string] => e[1] !== undefined && e[1] !== ""));
}

export function renderTemplate(template: string, ctx: RenderContext = {}, mode: RenderMode = "preview"): RenderResult {
  if (!template) return { text: "", missing: [] };

  const clock = clockValues(ctx.now ?? new Date(), ctx.timezone ?? DEFAULT_TIMEZONE);
  const texts = contextTexts(ctx);
  const missing = new Set<string>();

  const resolve = (slug: string): string | null => {
    if (clock[slug] !== undefined) return clock[slug];
    if (texts[slug] !== undefined) return texts[slug];

    const limit = RANKING_LIMITS[slug];
    if (limit !== undefined) {
      if (ctx.creatives && ctx.creatives.length > 0) return formatCreativeRanking(ctx.creatives, limit, ctx.currency);
      return mode === "preview" ? formatCreativeRanking(DEMO_CREATIVES, limit, ctx.currency) : null;
    }
    const simpleLimit = SIMPLE_RANKING_LIMITS[slug];
    if (simpleLimit !== undefined) {
      if (ctx.creatives && ctx.creatives.length > 0) return formatCreativeSimple(ctx.creatives, simpleLimit);
      return mode === "preview" ? formatCreativeSimple(DEMO_CREATIVES, simpleLimit) : null;
    }

    const def = VARIABLE_BY_SLUG.get(slug);
    const metric = ctx.metrics?.[slug];
    const mask = ctx.maskRealValues && def ? MASKS[def.returns] : undefined;

    if (metric !== undefined) return mask ?? formatMetric(metric, def?.returns ?? "text", ctx.currency);
    if (mode === "preview" && def?.exampleValue !== undefined) return mask ?? String(def.exampleValue);
    return null;
  };

  const text = template.replace(PLACEHOLDER, (_match, slug: string) => {
    const value = resolve(slug);
    if (value !== null) return value;
    missing.add(slug);
    return EMPTY;
  });

  return { text, missing: [...missing] };
}
