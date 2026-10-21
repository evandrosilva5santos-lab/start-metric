import type { ReportPeriod } from "@/lib/reports/period";
import type { ReportFrequency } from "@/lib/reports/schedule";

export type ReportStatus = "draft" | "active" | "paused";
export type RunStatus = "queued" | "generated" | "sent" | "received" | "approved" | "failed" | "skipped";
export type DeliveryStep = "sent" | "received" | "approved";

export interface LatestRun {
  id: string;
  status: RunStatus;
  scheduled_for: string;
  created_at: string;
}

export interface ReportListItem {
  id: string;
  client_id: string;
  name: string;
  status: ReportStatus;
  frequency: ReportFrequency;
  send_time: string;
  weekday: number | null;
  month_day: number | null;
  timezone: string;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
  client_name: string | null;
  latest_run: LatestRun | null;
}

export interface ReportPart {
  id: string;
  position: number;
  ad_account_id: string | null;
  period: ReportPeriod;
  custom_start: string | null;
  custom_end: string | null;
  body: string;
  send_without_data: boolean;
}

export type ReportDetail = Omit<ReportListItem, "latest_run"> & { parts: ReportPart[] };

export interface ReportRun {
  id: string;
  report_id: string;
  scheduled_for: string;
  status: RunStatus;
  rendered_body: string | null;
  missing_variables: string[];
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  sent_at: string | null;
  received_at: string | null;
  approved_at: string | null;
  sent_by: string | null;
  delivery_note: string | null;
  created_at: string;
}

export interface GenerateResult {
  run_id: string;
  status: RunStatus;
  rendered_body: string | null;
  missing_variables: string[];
  warnings: string[];
}

export interface PreviewResult {
  text: string;
  missing: string[];
  warnings: string[];
}

export interface ClientOption {
  id: string;
  name: string;
}

export interface AdAccountOption {
  id: string;
  name: string;
  external_id: string;
  platform: string;
  status: string | null;
}

export type ReportPayloadPart = {
  ad_account_id: string | null;
  period: ReportPeriod;
  custom_start: string | null;
  custom_end: string | null;
  body: string;
  send_without_data: boolean;
};

export interface ReportPayload {
  client_id: string;
  name: string;
  status: ReportStatus;
  frequency: ReportFrequency;
  send_time: string;
  weekday: number | null;
  month_day: number | null;
  timezone: string;
  parts: ReportPayloadPart[];
}
