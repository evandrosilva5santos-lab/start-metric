import { formatInteger } from "@/lib/format";

export const DASH = "—";

/** Ausência é travessão; zero é medido. */
export function fmtCount(value: number | null | undefined): string {
  return typeof value === "number" && Number.isFinite(value) ? formatInteger(value) : DASH;
}

export function fmtDays(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return DASH;
  return value === 1 ? "1 dia" : `${formatInteger(value)} dias`;
}

export function fmtScore(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return DASH;
  return formatInteger(Math.round(value));
}

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const dateOnly = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric" });

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return DASH;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? dateTime.format(t) : DASH;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return DASH;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? dateOnly.format(t) : DASH;
}

/** "2026-09-24" → "24/09" sem passar por fuso. */
export function fmtDayKey(day: string): string {
  const [, m, d] = day.split("-");
  return d && m ? `${d}/${m}` : day;
}

export function fmtDuration(fromIso: string, toIso: string | null, now: number): string {
  const start = Date.parse(fromIso);
  const end = toIso ? Date.parse(toIso) : now;
  if (!Number.isFinite(start) || !Number.isFinite(end)) return DASH;
  const secs = Math.max(0, Math.round((end - start) / 1000));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}min ${String(s).padStart(2, "0")}s` : `${s}s`;
}
