import { VARIABLE_BY_SLUG } from "@/lib/reports/engine/catalog";
import { DEFAULT_REPORT_TIMEZONE, type ReportPeriod } from "@/lib/reports/period";
import type { ReportFrequency } from "@/lib/reports/schedule";
import type { ReportDetail, ReportPayload, ReportStatus } from "../types";

export const MAX_PARTS = 30;
export const MAX_BODY = 20_000;

export interface PartDraft {
  key: string;
  ad_account_id: string | null;
  period: ReportPeriod;
  custom_start: string;
  custom_end: string;
  body: string;
  send_without_data: boolean;
}

export interface ReportDraft {
  id: string | null;
  name: string;
  client_id: string;
  status: ReportStatus;
  frequency: ReportFrequency;
  send_time: string;
  weekday: number | null;
  month_day: number | null;
  timezone: string;
  parts: PartDraft[];
}

const PLACEHOLDER = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

let keySeed = 0;
function nextKey(): string {
  keySeed += 1;
  return `part-${Date.now().toString(36)}-${keySeed}`;
}

export function emptyPart(): PartDraft {
  return {
    key: nextKey(),
    ad_account_id: null,
    period: "yesterday",
    custom_start: "",
    custom_end: "",
    body: "",
    send_without_data: false,
  };
}

export function emptyDraft(clientId: string | null): ReportDraft {
  return {
    id: null,
    name: "",
    client_id: clientId ?? "",
    status: "draft",
    frequency: "daily",
    send_time: "08:00",
    weekday: null,
    month_day: null,
    timezone: DEFAULT_REPORT_TIMEZONE,
    parts: [emptyPart()],
  };
}

export function draftFromReport(report: ReportDetail): ReportDraft {
  const parts = [...report.parts].sort((a, b) => a.position - b.position);
  return {
    id: report.id,
    name: report.name,
    client_id: report.client_id,
    status: report.status,
    frequency: report.frequency,
    send_time: report.send_time.slice(0, 5),
    weekday: report.weekday,
    month_day: report.month_day,
    timezone: report.timezone,
    parts: parts.length
      ? parts.map((p) => ({
          key: p.id,
          ad_account_id: p.ad_account_id,
          period: p.period,
          custom_start: p.custom_start ?? "",
          custom_end: p.custom_end ?? "",
          body: p.body,
          send_without_data: p.send_without_data,
        }))
      : [emptyPart()],
  };
}

export function toPayload(draft: ReportDraft): ReportPayload {
  return {
    client_id: draft.client_id,
    name: draft.name.trim(),
    status: draft.status,
    frequency: draft.frequency,
    send_time: draft.send_time,
    weekday: draft.frequency === "weekly" ? draft.weekday : null,
    month_day: draft.frequency === "monthly" ? draft.month_day : null,
    timezone: draft.timezone,
    parts: draft.parts.map((p) => ({
      ad_account_id: p.ad_account_id,
      period: p.period,
      custom_start: p.period === "custom" ? p.custom_start || null : null,
      custom_end: p.period === "custom" ? p.custom_end || null : null,
      body: p.body,
      send_without_data: p.send_without_data,
    })),
  };
}

export function validateDraft(draft: ReportDraft): string[] {
  const errors: string[] = [];
  if (!draft.name.trim()) errors.push("Dê um nome ao relatório.");
  if (!draft.client_id) errors.push("Escolha o cliente.");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.send_time)) errors.push("Horário de geração inválido.");
  if (draft.frequency === "weekly" && draft.weekday === null) errors.push("Relatório semanal precisa do dia da semana.");
  if (draft.frequency === "monthly" && draft.month_day === null) errors.push("Relatório mensal precisa do dia do mês.");
  draft.parts.forEach((part, index) => {
    const label = `Parte ${index + 1}`;
    if (!part.body.trim()) errors.push(`${label}: escreva o texto.`);
    if (part.body.length > MAX_BODY) errors.push(`${label}: texto passa de ${MAX_BODY} caracteres.`);
    if (part.period === "custom" && (!part.custom_start || !part.custom_end || part.custom_start > part.custom_end)) {
      errors.push(`${label}: período personalizado precisa de início e fim, com início antes do fim.`);
    }
  });
  return errors;
}

export function slugsIn(body: string): string[] {
  return [...new Set([...body.matchAll(PLACEHOLDER)].map((m) => m[1]))];
}

export function unknownSlugs(parts: readonly PartDraft[]): string[] {
  return [...new Set(parts.flatMap((p) => slugsIn(p.body)).filter((slug) => !VARIABLE_BY_SLUG.has(slug)))];
}

export function updatePart(parts: readonly PartDraft[], key: string, patch: Partial<PartDraft>): PartDraft[] {
  return parts.map((p) => (p.key === key ? { ...p, ...patch } : p));
}

export function movePart(parts: readonly PartDraft[], key: string, delta: -1 | 1): PartDraft[] {
  const from = parts.findIndex((p) => p.key === key);
  const to = from + delta;
  if (from < 0 || to < 0 || to >= parts.length) return [...parts];
  const next = [...parts];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export function removePart(parts: readonly PartDraft[], key: string): PartDraft[] {
  return parts.length <= 1 ? [...parts] : parts.filter((p) => p.key !== key);
}

export function isSameDraft(a: ReportDraft, b: ReportDraft): boolean {
  return JSON.stringify(toPayload(a)) === JSON.stringify(toPayload(b));
}
