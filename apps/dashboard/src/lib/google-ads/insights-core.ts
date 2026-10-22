// Núcleo das abas de análise do Google Ads: indicadores derivados, ordenação, busca, CSV e estados de célula.
// Módulo puro (sem rede nem banco) para ser testado com `node --test`.

export type RawMetrics = {
  costMicros: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversionsValue: number;
};

export type DerivedMetrics = {
  spend: number;
  ctr: number | null;
  cpc: number | null;
  cpa: number | null;
  conversionRate: number | null;
  roas: number | null;
};

const ratio = (a: number, b: number, factor = 1): number | null => (b > 0 ? (a / b) * factor : null);

/** Indicadores calculados; sem denominador o resultado é `null`, nunca um zero inventado. */
export function deriveMetrics(m: RawMetrics): DerivedMetrics {
  const spend = m.costMicros / 1_000_000;
  return {
    spend,
    ctr: ratio(m.clicks, m.impressions, 100),
    cpc: ratio(spend, m.clicks),
    cpa: ratio(spend, m.conversions),
    conversionRate: ratio(m.conversions, m.clicks, 100),
    roas: ratio(m.conversionsValue, spend),
  };
}

const normalize = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

type Sortable = string | number | null | undefined;

export type SortDirection = "asc" | "desc";

/** Ordena sem alterar a lista original; valores ausentes ficam sempre no fim, em qualquer direção. */
export function sortRows<T extends Record<string, unknown>>(rows: readonly T[], key: keyof T & string, direction: SortDirection): T[] {
  const sign = direction === "asc" ? 1 : -1;
  const present = (v: Sortable) => v !== null && v !== undefined && !(typeof v === "number" && Number.isNaN(v));
  return rows
    .map((row, index) => ({ row, index, value: row[key] as Sortable }))
    .sort((a, b) => {
      const aHas = present(a.value);
      const bHas = present(b.value);
      if (!aHas || !bHas) return aHas === bHas ? a.index - b.index : aHas ? -1 : 1;
      const diff =
        typeof a.value === "number" && typeof b.value === "number"
          ? a.value - b.value
          : normalize(String(a.value)).localeCompare(normalize(String(b.value)), "pt-BR");
      return diff !== 0 ? sign * diff : a.index - b.index;
    })
    .map((entry) => entry.row);
}

/** Busca sem diferenciar acento nem caixa nos campos indicados; busca vazia não filtra. */
export function filterRows<T extends Record<string, unknown>>(rows: readonly T[], query: string, fields: ReadonlyArray<keyof T & string>): T[] {
  const needle = normalize(query.trim());
  if (!needle) return [...rows];
  return rows.filter((row) => fields.some((f) => normalize(String(row[f] ?? "")).includes(needle)));
}

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const NUMBER_RUN = /\+?\d[\d\s().-]{6,}\d/g;
const MIN_PRIVATE_DIGITS = 8;

/** Termos de busca são texto livre: esconde e-mail e sequências longas de dígitos (telefone, CPF) antes de exibir ou exportar. */
export function maskPii(text: string): string {
  return text
    .replace(EMAIL, "[e-mail oculto]")
    .replace(NUMBER_RUN, (match) => (match.replace(/\D/g, "").length >= MIN_PRIVATE_DIGITS ? "[número oculto]" : match));
}

export type CsvColumn = { key: string; label: string };

const FORMULA_START = /^[=+\-@\t\r]/;

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value).replace(".", ",") : "";
  let text = String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CSV para o Excel em português: `;` como separador, vírgula decimal, BOM e proteção contra fórmulas. */
export function toCsv(columns: readonly CsvColumn[], rows: ReadonlyArray<Record<string, unknown>>): string {
  const header = columns.map((c) => csvCell(c.label)).join(";");
  const body = rows.map((row) => columns.map((c) => csvCell(row[c.key])).join(";"));
  return `﻿${[header, ...body].join("\r\n")}`;
}

export type CellState = { kind: "value"; value: number } | { kind: "unavailable" } | { kind: "not_applicable" };

/**
 * Separa três situações que não podem se misturar na tela:
 * zero real, valor que a API não entregou e métrica que não existe para o tipo de campanha.
 */
export function cellState(value: number | null | undefined, options: { applicable: boolean }): CellState {
  if (!options.applicable) return { kind: "not_applicable" };
  if (value === null || value === undefined || Number.isNaN(value)) return { kind: "unavailable" };
  return { kind: "value", value };
}
