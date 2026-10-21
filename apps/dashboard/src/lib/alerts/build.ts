import { severityFor, targetKey, type EvaluationPeriod } from "./evaluation";
import { alertTitle, buildAlertMessage } from "./message";
import type { AlertMetadata, AlertMetric, AlertOperator, AlertSeverity } from "./types";

export type AlertCandidate = {
  kind: "campaign" | "account";
  id: string;
  value: number;
  accountId: string | null;
  accountName: string | null;
  clientId: string | null;
  clientName: string | null;
  campaignName: string | null;
  currency: string | null;
  spend: number | null;
  accountStatus: string | null;
  severity?: AlertSeverity;
};

export type RuleForBuild = {
  id: string;
  org_id: string;
  metric: AlertMetric;
  operator: AlertOperator;
  threshold: number;
  channel: string;
  template_body: string | null;
};

export type AlertInsert = {
  org_id: string;
  rule_id: string;
  campaign_id: string | null;
  metric: AlertMetric;
  operator: AlertOperator;
  threshold: number;
  observed_value: number;
  channel: string;
  title: string;
  message: string;
  status: "unread";
  severity: AlertSeverity;
  metadata: AlertMetadata;
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function buildAlertInsert(
  rule: RuleForBuild,
  candidate: AlertCandidate,
  period: EvaluationPeriod,
  now: Date,
): AlertInsert {
  const threshold = Number(rule.threshold);
  const observed = round2(candidate.value);
  const rendered = buildAlertMessage(rule, {
    value: observed,
    threshold,
    accountName: candidate.accountName,
    campaignName: candidate.campaignName,
    clientName: candidate.clientName,
    period,
    spend: candidate.spend,
    currency: candidate.currency,
    accountStatus: candidate.accountStatus,
  });

  return {
    org_id: rule.org_id,
    rule_id: rule.id,
    campaign_id: candidate.kind === "campaign" ? candidate.id : null,
    metric: rule.metric,
    operator: rule.operator,
    threshold,
    observed_value: observed,
    channel: rule.channel,
    title: alertTitle(rule.metric),
    message: rendered.text,
    status: "unread",
    severity: candidate.severity ?? severityFor(observed, rule.operator, threshold),
    metadata: {
      target_key: targetKey(candidate.kind, candidate.id),
      target_kind: candidate.kind,
      period_start: period.start,
      period_end: period.end,
      ad_account_id: candidate.accountId,
      ad_account_name: candidate.accountName,
      client_id: candidate.clientId,
      client_name: candidate.clientName,
      campaign_name: candidate.campaignName,
      currency: candidate.currency,
      account_status: candidate.accountStatus,
      spend: candidate.spend,
      missing_variables: rendered.missing,
      evaluated_at: now.toISOString(),
    },
  };
}
