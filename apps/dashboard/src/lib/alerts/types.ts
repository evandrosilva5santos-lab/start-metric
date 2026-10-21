export type AlertMetric = "roas" | "cpa" | "spend_no_conversion" | "ctr_below" | "api_error" | "balance_below";
export type SupportedAlertMetric = Exclude<AlertMetric, "balance_below">;
export type AlertOperator = "lt" | "gt" | "eq";
export type AlertSeverity = "critical" | "warning" | "info";
export type TriageState = "open" | "acknowledged" | "resolved";

export type NotificationRuleRow = {
  id: string;
  org_id: string;
  campaign_id: string | null;
  client_id: string | null;
  ad_account_id: string | null;
  metric: AlertMetric;
  operator: AlertOperator;
  threshold: number;
  channel: "web_push";
  template_body: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type AlertMetadata = {
  target_key?: string;
  target_kind?: "campaign" | "account";
  period_start?: string;
  period_end?: string;
  ad_account_id?: string | null;
  ad_account_name?: string | null;
  client_id?: string | null;
  client_name?: string | null;
  campaign_name?: string | null;
  currency?: string | null;
  account_status?: string | null;
  spend?: number | null;
  missing_variables?: string[];
  evaluated_at?: string;
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
  severity?: AlertSeverity | null;
  assigned_to?: string | null;
  acknowledged_at?: string | null;
  resolved_at?: string | null;
  resolution_note?: string | null;
  metadata?: AlertMetadata | null;
};

export type AlertTriageItem = AlertRow & {
  state: TriageState;
  campaign_name: string | null;
  account_name: string | null;
  client_name: string | null;
};

export type AlertTriagePage = {
  items: AlertTriageItem[];
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
};

export type AlertAssignee = {
  id: string;
  name: string | null;
};

export type AlertRuleInput = {
  metric: SupportedAlertMetric;
  operator?: AlertOperator;
  threshold: number;
  campaign_id?: string | null;
  client_id?: string | null;
  ad_account_id?: string | null;
  template_body?: string | null;
  active?: boolean;
};
