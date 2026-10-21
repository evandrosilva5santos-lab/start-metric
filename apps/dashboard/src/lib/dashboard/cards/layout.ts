import { aggregateDailyMetrics, type DailyMetricRow } from "../../reports/engine/metrics";
import { formatInteger, formatMoney, formatRate, formatRatio } from "../../format";
import type { ObjectiveKind } from "./objective";
import { CARD_BY_SLUG, MAX_CARDS, type CardDefinition, type CardFormat, type CardGroup, type CardSense } from "./catalog";

const DASH = "—";
const DEFAULT_CURRENCY = "BRL";

export interface CardInput {
  metrics: Readonly<Record<string, number>>;
  actionsComplete: boolean;
}

export interface CardValue {
  slug: string;
  label: string;
  group: CardGroup;
  format: CardFormat;
  sense: CardSense;
  hint: string;
  value: number | null;
  previous: number | null;
  delta: number | undefined;
  pending: boolean;
}

export interface ClientCardsModel {
  clientId: string;
  clientName: string;
  source: "saved" | "default";
  objective: ObjectiveKind | null;
  defaultLabel: string;
  defaultCards: string[];
  activeCards: string[];
  cards: CardValue[];
  layoutAvailable: boolean;
  truncated: boolean;
}

export type CardValidation = { ok: true; cards: string[] } | { ok: false; error: string };

function unique(list: readonly string[]): string[] {
  return [...new Set(list)];
}

export function validateCardSlugs(input: unknown): CardValidation {
  if (!Array.isArray(input) || input.some((slug) => typeof slug !== "string")) {
    return { ok: false, error: "Envie a lista de métricas como texto." };
  }
  const cards = unique(input as string[]);
  const unknown = cards.filter((slug) => !CARD_BY_SLUG.has(slug));
  if (unknown.length > 0) return { ok: false, error: `Métrica desconhecida: ${unknown.join(", ")}.` };
  if (cards.length === 0) return { ok: false, error: "Escolha pelo menos uma métrica." };
  if (cards.length > MAX_CARDS) return { ok: false, error: `Escolha no máximo ${MAX_CARDS} métricas.` };
  return { ok: true, cards };
}

export function sanitizeStoredCards(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null;
  const known = unique(input.filter((slug): slug is string => typeof slug === "string" && CARD_BY_SLUG.has(slug)));
  return known.length === 0 ? null : known.slice(0, MAX_CARDS);
}

function hasActions(row: DailyMetricRow): boolean {
  return row.actions !== null && row.actions !== undefined && typeof row.actions === "object";
}

export function summarizeRows(rows: readonly DailyMetricRow[]): CardInput {
  return {
    metrics: aggregateDailyMetrics(rows),
    actionsComplete: rows.length > 0 && rows.every(hasActions),
  };
}

function finite(value: number | undefined): number | null {
  return value !== undefined && Number.isFinite(value) ? value : null;
}

function resolve(card: CardDefinition, input: CardInput | null): number | null {
  if (!input) return null;
  if (card.requires === "actions" && !input.actionsComplete) return null;
  const value = finite(card.compute(input.metrics));
  if (value === null && card.zeroWhenAbsent && input.actionsComplete) return 0;
  return value;
}

export function percentDelta(current: number | null, previous: number | null): number | undefined {
  if (current === null || previous === null || previous === 0) return undefined;
  return ((current - previous) / Math.abs(previous)) * 100;
}

export function computeCardValues(
  slugs: readonly string[],
  current: CardInput,
  previous: CardInput | null,
): CardValue[] {
  return slugs.flatMap((slug) => {
    const card = CARD_BY_SLUG.get(slug);
    if (!card) return [];
    const value = resolve(card, current);
    const before = resolve(card, previous);
    return [
      {
        slug,
        label: card.label,
        group: card.group,
        format: card.format,
        sense: card.sense,
        hint: card.hint,
        value,
        previous: before,
        delta: percentDelta(value, before),
        pending: card.requires === "actions" && !current.actionsComplete,
      },
    ];
  });
}

export function formatCardValue(format: CardFormat, value: number | null, hidden: boolean, currency = DEFAULT_CURRENCY): string {
  if (value === null || !Number.isFinite(value)) return DASH;
  if (format === "currency") return formatMoney(value, currency, hidden);
  if (format === "percent") return formatRate(value);
  if (format === "ratio") return formatRatio(value, hidden);
  return formatInteger(value, hidden);
}

export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) return [...list];
  const without = list.filter((_, index) => index !== from);
  return [...without.slice(0, to), list[from], ...without.slice(to)];
}

export function sameCards(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((slug, index) => slug === b[index]);
}
