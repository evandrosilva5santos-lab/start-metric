// Janelas de busca de act_{id}/activities no fuso da conta.
// A Meta trata since e until como inclusivos: a janela de um dia termina 1 s antes do dia seguinte.

export type ActivityWindow = { since: number; until: number };

const DAY_MS = 86_400_000;
const MIN_SPLIT_SECONDS = 3_600;

function offsetMinutes(timeZone: string, at: Date): number {
  const part = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(at)
    .find((p) => p.type === "timeZoneName")?.value;
  const match = part?.match(/GMT([+-])(\d{2}):?(\d{2})?/);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (Number(match[2]) * 60 + Number(match[3] ?? 0));
}

/** Instante (segundos unix) da meia-noite de `day` (AAAA-MM-DD) no fuso informado. */
export function zonedDayStartUtc(day: string, timeZone: string): number {
  const [y, m, d] = day.split("-").map(Number);
  const utcMidnight = Date.UTC(y, m - 1, d);
  const firstGuess = utcMidnight - offsetMinutes(timeZone, new Date(utcMidnight)) * 60_000;
  const corrected = utcMidnight - offsetMinutes(timeZone, new Date(firstGuess)) * 60_000;
  return Math.floor(corrected / 1000);
}

/** Dia local (AAAA-MM-DD) de um instante em segundos unix. */
export function localDay(epochSeconds: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(epochSeconds * 1000),
  );
}

export function addDays(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + delta * DAY_MS).toISOString().slice(0, 10);
}

export function dayWindow(day: string, timeZone: string): ActivityWindow {
  const since = zonedDayStartUtc(day, timeZone);
  const next = zonedDayStartUtc(addDays(day, 1), timeZone);
  return { since, until: next - 1 };
}

/** Divide ao meio sem sobrepor segundos; janelas de até 1 h não se dividem mais. */
export function splitWindow(window: ActivityWindow): [ActivityWindow, ActivityWindow] | null {
  if (window.until - window.since + 1 <= MIN_SPLIT_SECONDS) return null;
  const mid = window.since + Math.floor((window.until - window.since) / 2);
  return [
    { since: window.since, until: mid },
    { since: mid + 1, until: window.until },
  ];
}

type PlanInput = { today: string; lookbackDays: number; completeDays: ReadonlySet<string>; maxDays: number };

/** Hoje e ontem sempre (eventos chegam atrasados); depois os dias sem cobertura completa, do mais novo ao mais antigo. */
export function planSyncDays({ today, lookbackDays, completeDays, maxDays }: PlanInput): string[] {
  const days = [today, addDays(today, -1)];
  for (let back = 2; back <= lookbackDays && days.length < maxDays; back++) {
    const day = addDays(today, -back);
    if (!completeDays.has(day)) days.push(day);
  }
  return days.slice(0, maxDays);
}
