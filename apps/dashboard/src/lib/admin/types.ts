export type AdminPlanStatus = "draft" | "active" | "archived";

export type AdminPlan = {
  id: string;
  code: string;
  name: string;
  status: AdminPlanStatus;
  description: string | null;
  price_monthly_mock: number | null;
  price_yearly_mock: number | null;
  is_mock: boolean;
  created_at: string;
  updated_at: string;
  subscription_count?: number;
};

export type AdminUserRole = "owner" | "manager" | "analyst" | "viewer";

export type AdminUser = {
  id: string;
  email: string | null;
  name: string | null;
  phone: string | null;
  role: AdminUserRole | string;
  created_at: string | null;
  subscription: {
    plan_id: string;
    plan_name: string;
    plan_code: string;
    status: "trial" | "active" | "paused" | "cancelled";
    started_at: string;
    ends_at: string | null;
  } | null;
};

export type AdminLogLevel = "debug" | "info" | "warning" | "error" | "critical";

export type AdminUserLog = {
  id: string;
  user_id: string | null;
  actor_user_id: string | null;
  level: AdminLogLevel;
  event: string;
  error_code: string | null;
  error_message: string | null;
  root_cause: string;
  detailed_analysis: string | null;
  context_json: Record<string, unknown>;
  stack_trace: string | null;
  request_id: string | null;
  source: string;
  created_at: string;
  user_name?: string | null;
  actor_name?: string | null;
};

export type AdminProblemSeverity = "low" | "medium" | "high" | "critical";

export type AdminProblemStatus = "open" | "investigating" | "resolved" | "ignored";

export type AdminProblem = {
  id: string;
  user_id: string | null;
  log_id: string | null;
  title: string;
  severity: AdminProblemSeverity;
  status: AdminProblemStatus;
  symptom: string;
  root_cause: string;
  detailed_analysis: string;
  impact: string;
  resolution_notes: string | null;
  first_seen_at: string;
  last_seen_at: string;
  occurrences: number;
  created_at: string;
  updated_at: string;
  user_name?: string | null;
  log_event?: string | null;
};

export type AdminRevenueSnapshot = {
  id: string;
  snapshot_date: string;
  mrr: number;
  arr: number;
  churn_rate: number;
  new_customers: number;
  notes: string | null;
  is_mock: boolean;
  created_at: string;
};
