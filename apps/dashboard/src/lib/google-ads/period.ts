// Períodos das telas do Google Ads (fuso de São Paulo). Módulo puro.

export type Preset = "7d" | "14d" | "30d" | "month" | "last_month";

export const PRESETS: Array<{ id: Preset; label: string }> = [
  { id: "7d", label: "7 dias" },
  { id: "14d", label: "14 dias" },
  { id: "30d", label: "30 dias" },
  { id: "month", label: "Este mês" },
  { id: "last_month", label: "Mês passado" },
];

export const TIMEZONE = "America/Sao_Paulo";
const MAX_SPAN_DAYS = 366;
const DAY_MS = 86_400_000;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export function todayIn(timezone: string = TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

export function rangeFor(preset: Preset, today: string = todayIn()): { from: string; to: string } {
  const yesterday = shiftDay(today, -1);
  const monthStart = `${today.slice(0, 8)}01`;
  switch (preset) {
    case "14d":
      return { from: shiftDay(yesterday, -13), to: yesterday };
    case "30d":
      return { from: shiftDay(yesterday, -29), to: yesterday };
    case "month":
      return { from: monthStart, to: today };
    case "last_month":
      return { from: `${shiftDay(monthStart, -1).slice(0, 8)}01`, to: shiftDay(monthStart, -1) };
    default:
      return { from: shiftDay(yesterday, -6), to: yesterday };
  }
}

const isRealDay = (value: string): boolean => DAY.test(value) && shiftDay(value, 0) === value;

/** Datas reais, início não depois do fim e no máximo 366 dias (o limite que a API aceita). */
export function isValidRange(from: string, to: string): boolean {
  if (!isRealDay(from) || !isRealDay(to)) return false;
  const span = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS;
  return span >= 0 && span < MAX_SPAN_DAYS;
}
