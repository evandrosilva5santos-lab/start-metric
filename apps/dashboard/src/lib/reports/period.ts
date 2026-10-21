export const REPORT_PERIODS = ["yesterday", "last_7d", "last_30d", "this_month", "last_month", "custom"] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

export const DEFAULT_REPORT_TIMEZONE = "America/Sao_Paulo";

export interface PeriodInput {
  period: ReportPeriod;
  customStart?: string | null;
  customEnd?: string | null;
}

export interface ResolvedPeriod {
  since: string;
  until: string;
  startDate: string;
  endDate: string;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function localDateIn(now: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(dateIso: string, days: number): string {
  const date = new Date(`${dateIso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function monthStart(dateIso: string): string {
  return `${dateIso.slice(0, 7)}-01`;
}

export function formatDateBr(dateIso: string): string {
  const [year, month, day] = dateIso.split("-");
  return `${day}/${month}/${year}`;
}

function rangeFor(input: PeriodInput, today: string): { since: string; until: string } {
  const yesterday = addDays(today, -1);
  switch (input.period) {
    case "yesterday":
      return { since: yesterday, until: yesterday };
    case "last_7d":
      return { since: addDays(today, -7), until: yesterday };
    case "last_30d":
      return { since: addDays(today, -30), until: yesterday };
    case "this_month":
      return { since: monthStart(today), until: today };
    case "last_month": {
      const until = addDays(monthStart(today), -1);
      return { since: monthStart(until), until };
    }
    case "custom": {
      const { customStart, customEnd } = input;
      if (!isIsoDate(customStart) || !isIsoDate(customEnd) || customStart > customEnd) {
        throw new Error("Período personalizado exige início e fim válidos (AAAA-MM-DD), com início ≤ fim.");
      }
      return { since: customStart, until: customEnd };
    }
  }
}

export function resolvePeriod(input: PeriodInput, now: Date, timeZone: string = DEFAULT_REPORT_TIMEZONE): ResolvedPeriod {
  const { since, until } = rangeFor(input, localDateIn(now, timeZone));
  return { since, until, startDate: formatDateBr(since), endDate: formatDateBr(until) };
}
