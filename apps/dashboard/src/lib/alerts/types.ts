export type AlertMetric = "roas" | "cpa" | "spend_no_conversion";
export type AlertOperator = "lt" | "gt" | "eq";

export type NotificationRuleRow = {
  id: string;
  org_id: string;
  campaign_id: string | null;
  metric: AlertMetric;
  operator: AlertOperator;
  threshold: number;
  channel: "web_push";
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type AlertRow = {
  id: string;
  org_id: string;
  rule_id: string;
  campaign_id: string | null;
  metric: AlertMetric;
  operator: AlertOperator;
  threshold: number;
  observed_value: number;
  channel: "web_push";
  title: string;
  message: string;
  status: "unread" | "read";
  triggered_at: string;
  read_at: string | null;
};

export type AlertRuleInput = {
  metric: AlertMetric;
  operator: AlertOperator;
  threshold: number;
  campaign_id?: string | null;
  active?: boolean;
};
