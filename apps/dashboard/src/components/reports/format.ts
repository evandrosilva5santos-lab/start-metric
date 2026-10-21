import type { PillTone } from "@/components/ui/badge";
import type { ReportPeriod } from "@/lib/reports/period";
import type { ReportFrequency } from "@/lib/reports/schedule";
import type { ReportListItem, ReportRun, ReportStatus, RunStatus } from "./types";

export const EMPTY = "—";

export const FREQUENCY_LABEL: Record<ReportFrequency, string> = {
  daily: "Diário",
  weekly: "Semanal",
  monthly: "Mensal",
};

export const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;

export const PERIOD_LABEL: Record<ReportPeriod, string> = {
  yesterday: "Ontem",
  last_7d: "Últimos 7 dias",
  last_30d: "Últimos 30 dias",
  this_month: "Mês atual",
  last_month: "Mês anterior",
  custom: "Personalizado",
};

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  active: "Ativo",
  paused: "Pausado",
  draft: "Rascunho",
};

export const REPORT_STATUS_TONE: Record<ReportStatus, PillTone> = {
  active: "ok",
  paused: "neu",
  draft: "off",
};

export const RUN_STATUS_LABEL: Record<RunStatus, string> = {
  queued: "Na fila",
  generated: "Gerado · falta enviar",
  sent: "Enviado",
  received: "Recebido",
  approved: "Aprovado",
  failed: "Falhou",
  skipped: "Pulado",
};

export const RUN_STATUS_TONE: Record<RunStatus, PillTone> = {
  queued: "neu",
  generated: "warn",
  sent: "ag",
  received: "cli",
  approved: "ok",
  failed: "bad",
  skipped: "off",
};

const dateTime = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const fullDateTime = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateTime(iso: string | null | undefined, withYear = false): string {
  if (!iso) return EMPTY;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return EMPTY;
  return (withYear ? fullDateTime : dateTime).format(date).replace(",", " ·");
}

export function scheduleSummary(report: Pick<ReportListItem, "frequency" | "send_time" | "weekday" | "month_day">): string {
  const time = report.send_time.slice(0, 5);
  if (report.frequency === "weekly" && report.weekday !== null) return `${WEEKDAYS[report.weekday]} · ${time}`;
  if (report.frequency === "monthly" && report.month_day !== null) return `Dia ${report.month_day} · ${time}`;
  return `Todo dia · ${time}`;
}

export function isOverdue(report: ReportListItem, now: number): boolean {
  if (report.status !== "active" || !report.next_run_at) return false;
  const due = Date.parse(report.next_run_at);
  if (Number.isNaN(due) || due >= now) return false;
  const lastSlot = report.latest_run ? Date.parse(report.latest_run.scheduled_for) : Number.NaN;
  return Number.isNaN(lastSlot) || lastSlot < due;
}

export type ReportState = "overdue" | RunStatus | "never";

export function reportState(report: ReportListItem, now: number): ReportState {
  if (isOverdue(report, now)) return "overdue";
  return report.latest_run?.status ?? "never";
}

export const STATE_FILTERS = [
  { value: "atrasado", label: "Atrasados", match: (s: ReportState) => s === "overdue" },
  { value: "enviar", label: "Falta enviar", match: (s: ReportState) => s === "generated" },
  { value: "cliente", label: "Com o cliente", match: (s: ReportState) => s === "sent" || s === "received" },
  { value: "aprovado", label: "Aprovados", match: (s: ReportState) => s === "approved" },
  { value: "falha", label: "Falhas", match: (s: ReportState) => s === "failed" || s === "skipped" },
] as const;

export type StateFilter = (typeof STATE_FILTERS)[number]["value"];

export function parseStateFilter(raw: string | null): StateFilter | null {
  return STATE_FILTERS.some((f) => f.value === raw) ? (raw as StateFilter) : null;
}

const STATE_ORDER: Record<ReportState, number> = {
  overdue: 0,
  failed: 1,
  generated: 2,
  queued: 3,
  sent: 4,
  received: 5,
  never: 6,
  skipped: 7,
  approved: 8,
};

export function compareByUrgency(now: number) {
  return (a: ReportListItem, b: ReportListItem): number => {
    const diff = STATE_ORDER[reportState(a, now)] - STATE_ORDER[reportState(b, now)];
    if (diff !== 0) return diff;
    const aNext = a.next_run_at ? Date.parse(a.next_run_at) : Number.POSITIVE_INFINITY;
    const bNext = b.next_run_at ? Date.parse(b.next_run_at) : Number.POSITIVE_INFINITY;
    return aNext - bNext;
  };
}

const MANUAL_SECOND = 30;

export function generatedBy(run: Pick<ReportRun, "scheduled_for">): string {
  const date = new Date(run.scheduled_for);
  return date.getUTCSeconds() === MANUAL_SECOND ? "Gerado manualmente" : "Gerado pela agenda";
}
