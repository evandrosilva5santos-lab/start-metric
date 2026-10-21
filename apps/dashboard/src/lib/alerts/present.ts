import type { AlertMetric, AlertOperator, AlertSeverity, TriageState } from "./types";

export type PillTone = "ok" | "warn" | "bad" | "neu" | "off" | "cli" | "ag";

type Presentation = { label: string; tone: PillTone };

export const SEVERITY_PRESENTATION: Record<AlertSeverity, Presentation> = {
  critical: { label: "Crítico", tone: "bad" },
  warning: { label: "Atenção", tone: "warn" },
  info: { label: "Info", tone: "neu" },
};

export const STATE_PRESENTATION: Record<TriageState, Presentation> = {
  open: { label: "Aberto", tone: "ag" },
  acknowledged: { label: "Reconhecido", tone: "neu" },
  resolved: { label: "Resolvido", tone: "ok" },
};

export const STATE_FILTER_OPTIONS: readonly { value: TriageState | "all"; label: string }[] = [
  { value: "open", label: "Abertos" },
  { value: "acknowledged", label: "Reconhecidos" },
  { value: "resolved", label: "Resolvidos" },
  { value: "all", label: "Todos" },
];

export const SEVERITY_FILTER_OPTIONS: readonly { value: AlertSeverity | "all"; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "critical", label: "Crítico" },
  { value: "warning", label: "Atenção" },
  { value: "info", label: "Info" },
];

const METRIC_LABEL: Record<AlertMetric, string> = {
  roas: "ROAS abaixo do limite",
  cpa: "CPA acima do limite",
  spend_no_conversion: "Gasto sem conversão",
  ctr_below: "CTR abaixo do limite",
  api_error: "Conta com erro / sem sincronizar",
  balance_below: "Saldo abaixo do limite",
};

const THRESHOLD_HINT: Record<AlertMetric, string> = {
  roas: "Retorno mínimo (ex.: 2 = 2x)",
  cpa: "Custo máximo por resultado (R$)",
  spend_no_conversion: "Gasto máximo sem conversão (R$)",
  ctr_below: "CTR mínimo (%)",
  api_error: "Horas sem sincronizar (0 = só status)",
  balance_below: "Saldo mínimo (R$)",
};

export function severityPresentation(severity: AlertSeverity | null | undefined): Presentation {
  return severity ? SEVERITY_PRESENTATION[severity] : { label: "—", tone: "off" };
}

export function metricLabel(metric: AlertMetric): string {
  return METRIC_LABEL[metric] ?? metric;
}

export function thresholdHint(metric: AlertMetric): string {
  return THRESHOLD_HINT[metric] ?? "Limite";
}

export function operatorSymbol(operator: AlertOperator): string {
  if (operator === "lt") return "<";
  if (operator === "gt") return ">";
  return "=";
}

export function formatDateTimeBr(iso: string | null | undefined): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
