import { addDays, localDateIn } from "./period";

export const REPORT_FREQUENCIES = ["daily", "weekly", "monthly"] as const;
export type ReportFrequency = (typeof REPORT_FREQUENCIES)[number];

export interface ReportSchedule {
  frequency: ReportFrequency;
  sendTime: string;
  weekday: number | null;
  monthDay: number | null;
  timezone: string;
}

const SEARCH_DAYS = 63;

function wallClockUtc(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date(instant));
  const part = (type: Intl.DateTimeFormatPartTypes): number => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute"), part("second"));
}

function zonedTimeToUtc(dateIso: string, hour: number, minute: number, timeZone: string): number {
  const [year, month, day] = dateIso.split("-").map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const firstOffset = wallClockUtc(guess, timeZone) - guess;
  const candidate = guess - firstOffset;
  const secondOffset = wallClockUtc(candidate, timeZone) - candidate;
  return secondOffset === firstOffset ? candidate : guess - secondOffset;
}

function lastDayOfMonth(dateIso: string): number {
  const [year, month] = dateIso.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function matchesDay(schedule: ReportSchedule, dateIso: string): boolean {
  if (schedule.frequency === "daily") return true;
  if (schedule.frequency === "weekly") return new Date(`${dateIso}T00:00:00Z`).getUTCDay() === schedule.weekday;
  const day = Number(dateIso.slice(8, 10));
  return day === Math.min(schedule.monthDay ?? 1, lastDayOfMonth(dateIso));
}

function parseSendTime(sendTime: string): { hour: number; minute: number } {
  const [hour, minute] = sendTime.split(":").map(Number);
  return { hour, minute };
}

export function computeNextRunAt(schedule: ReportSchedule, now: Date): string {
  const { hour, minute } = parseSendTime(schedule.sendTime);
  const today = localDateIn(now, schedule.timezone);
  for (let offset = 0; offset <= SEARCH_DAYS; offset++) {
    const date = addDays(today, offset);
    if (!matchesDay(schedule, date)) continue;
    const instant = zonedTimeToUtc(date, hour, minute, schedule.timezone);
    if (instant > now.getTime()) return new Date(instant).toISOString();
  }
  throw new Error("Não foi possível calcular a próxima execução do relatório.");
}
