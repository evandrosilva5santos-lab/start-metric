import { ALERT_PRESETS, type AlertCondition, type AlertPreset } from "../reports/engine/presets";
import { formatCurrency, formatNumber, formatPercent, renderTemplate, type RenderResult } from "../reports/engine/render";
import type { AlertMetric } from "./types";

const EMPTY = "—";

const CONDITION_BY_METRIC: Record<AlertMetric, AlertCondition> = {
  roas: "roas_below",
  cpa: "cpa_above",
  spend_no_conversion: "spend_no_conversion",
  ctr_below: "ctr_below",
  api_error: "api_error",
  balance_below: "balance_below",
};

const TITLE_BY_METRIC: Record<AlertMetric, string> = {
  roas: "ROAS abaixo do limite",
  cpa: "CPA acima do limite",
  spend_no_conversion: "Gasto sem conversão",
  ctr_below: "CTR abaixo do limite",
  api_error: "Conta com erro ou sem sincronizar",
  balance_below: "Saldo abaixo do limite",
};

const ACCOUNT_STATUS_LABEL: Record<string, string> = {
  active: "Ativa",
  expired: "Token expirado",
  disconnected: "Desconectada",
};

export const ALERT_TEMPLATE_VARIABLES: readonly { slug: string; label: string }[] = [
  { slug: "account_name", label: "Conta" },
  { slug: "campaign_name", label: "Campanha" },
  { slug: "client_name", label: "Cliente" },
  { slug: "current_value", label: "Valor atual" },
  { slug: "target_value", label: "Limite" },
  { slug: "start_date", label: "Início do período" },
  { slug: "end_date", label: "Fim do período" },
  { slug: "meta_spend", label: "Investimento" },
  { slug: "account_status", label: "Status da conta" },
];

export type AlertMessageContext = {
  value: number | null;
  threshold: number;
  accountName?: string | null;
  campaignName?: string | null;
  clientName?: string | null;
  period?: { start: string; end: string } | null;
  spend?: number | null;
  currency?: string | null;
  accountStatus?: string | null;
};

export function presetConditionFor(metric: AlertMetric): AlertCondition {
  return CONDITION_BY_METRIC[metric];
}

export function presetFor(metric: AlertMetric): AlertPreset | undefined {
  const condition = presetConditionFor(metric);
  return ALERT_PRESETS.find((preset) => preset.conditionType === condition);
}

export function defaultTemplate(metric: AlertMetric): string {
  return presetFor(metric)?.content ?? "";
}

export function alertTitle(metric: AlertMetric): string {
  return TITLE_BY_METRIC[metric];
}

export function accountStatusLabel(status: string | null | undefined): string | null {
  if (!status) return null;
  return ACCOUNT_STATUS_LABEL[status] ?? status;
}

export function formatMetricValue(metric: AlertMetric, value: number | null | undefined, currency?: string | null): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return EMPTY;
  switch (metric) {
    case "roas":
      return `${formatNumber(value)}x`;
    case "ctr_below":
      return formatPercent(value);
    case "api_error":
      return `${formatNumber(value)} h`;
    default:
      return formatCurrency(value, currency || "BRL");
  }
}

export function formatDateBr(isoDate: string | null | undefined): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}/.test(isoDate)) return EMPTY;
  const [year, month, day] = isoDate.slice(0, 10).split("-");
  return `${day}/${month}/${year}`;
}

function texts(metric: AlertMetric, ctx: AlertMessageContext): Record<string, string> {
  const entries: Array<[string, string | null | undefined]> = [
    ["account_name", ctx.accountName],
    ["campaign_name", ctx.campaignName],
    ["client_name", ctx.clientName],
    ["current_value", ctx.value === null ? null : formatMetricValue(metric, ctx.value, ctx.currency)],
    ["target_value", formatMetricValue(metric, ctx.threshold, ctx.currency)],
    ["meta_spend", ctx.spend === null || ctx.spend === undefined ? null : formatCurrency(ctx.spend, ctx.currency || "BRL")],
    ["account_status", accountStatusLabel(ctx.accountStatus)],
  ];
  return Object.fromEntries(entries.filter((e): e is [string, string] => typeof e[1] === "string" && e[1] !== ""));
}

export function buildAlertMessage(
  rule: { metric: AlertMetric; template_body: string | null },
  ctx: AlertMessageContext,
): RenderResult {
  const template = rule.template_body?.trim() ? rule.template_body : defaultTemplate(rule.metric);
  return renderTemplate(
    template,
    {
      startDate: ctx.period ? formatDateBr(ctx.period.start) : undefined,
      endDate: ctx.period ? formatDateBr(ctx.period.end) : undefined,
      texts: texts(rule.metric, ctx),
      currency: ctx.currency || "BRL",
    },
    "live",
  );
}
