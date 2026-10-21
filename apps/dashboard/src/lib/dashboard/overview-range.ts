export type DateRange = { from: string; to: string };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string | undefined): value is string {
  return typeof value === "string" && ISO_DATE.test(value);
}

export function addDays(dateIso: string, days: number): string {
  const base = new Date(`${dateIso}T00:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  const ms = new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

export function previousRange(range: DateRange): DateRange {
  const length = daysBetween(range.from, range.to) + 1;
  const to = addDays(range.from, -1);
  return { from: addDays(to, -(length - 1)), to };
}

export function todayInTimezone(timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function shortDate(dateIso: string): string {
  const [, month, day] = dateIso.split("-");
  return `${day}/${month}`;
}

function monthStart(dateIso: string): string {
  return `${dateIso.slice(0, 7)}-01`;
}

export type RangePresetValue =
  | "today"
  | "yesterday"
  | "last_7d"
  | "last_14d"
  | "last_30d"
  | "this_month"
  | "last_month";

type RangePreset = {
  value: RangePresetValue;
  label: string;
  resolve: (today: string) => DateRange;
};

export const DEFAULT_PRESET: RangePresetValue = "last_30d";

export const RANGE_PRESETS: RangePreset[] = [
  { value: "today", label: "Hoje", resolve: (today) => ({ from: today, to: today }) },
  {
    value: "yesterday",
    label: "Ontem",
    resolve: (today) => ({ from: addDays(today, -1), to: addDays(today, -1) }),
  },
  { value: "last_7d", label: "Últimos 7 dias", resolve: (today) => ({ from: addDays(today, -6), to: today }) },
  { value: "last_14d", label: "Últimos 14 dias", resolve: (today) => ({ from: addDays(today, -13), to: today }) },
  { value: "last_30d", label: "Últimos 30 dias", resolve: (today) => ({ from: addDays(today, -29), to: today }) },
  { value: "this_month", label: "Este mês", resolve: (today) => ({ from: monthStart(today), to: today }) },
  {
    value: "last_month",
    label: "Mês passado",
    resolve: (today) => {
      const to = addDays(monthStart(today), -1);
      return { from: monthStart(to), to };
    },
  },
];

export function matchPreset(range: DateRange, today: string): RangePresetValue | null {
  const found = RANGE_PRESETS.find((preset) => {
    const candidate = preset.resolve(today);
    return candidate.from === range.from && candidate.to === range.to;
  });
  return found?.value ?? null;
}

export function resolvePreset(value: string, today: string): DateRange | null {
  return RANGE_PRESETS.find((preset) => preset.value === value)?.resolve(today) ?? null;
}
