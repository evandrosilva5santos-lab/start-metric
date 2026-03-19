import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ReportsClient } from "./ReportsClient";

export const metadata: Metadata = {
  title: "Relatórios | Start Metric",
  description: "Crie e agende relatórios automáticos de campanhas por WhatsApp ou e-mail.",
};

export type ScheduledReportRow = {
  id: string;
  name: string;
  frequency: "daily" | "weekly" | "monthly";
  recipients: string[];
  whatsapp_enabled: boolean;
  next_run_at: string;
  last_run_at: string | null;
  status: "active" | "paused" | "error";
  created_at: string;
};

export type ReportExecutionRow = {
  id: string;
  scheduled_report_id: string;
  status: "pending" | "generating" | "completed" | "failed";
  generated_at: string | null;
  error_message: string | null;
  created_at: string;
  scheduled_reports: { name: string } | null;
};

// NOTA: Funcionalidade de relatórios agendados será implementada na Sprint 5
// As tabelas scheduled_reports e report_executions ainda não existem no banco
async function getReportsData(_orgId: string) {
  // Temporariamente retornar arrays vazios até as tabelas serem criadas
  return {
    reports: [] as ScheduledReportRow[],
    executions: [] as ReportExecutionRow[],
  };

  /* TODO: Sprint 5 - Descomentar quando as tabelas existirem
  const supabase = await createClient();

  const [reportsResult, executionsResult] = await Promise.all([
    (supabase as any)
      .from("scheduled_reports")
      .select("id, name, frequency, recipients, whatsapp_enabled, next_run_at, last_run_at, status, created_at")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
    (supabase as any)
      .from("report_executions")
      .select("id, scheduled_report_id, status, generated_at, error_message, created_at, scheduled_reports(name)")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  return {
    reports: (reportsResult.data ?? []) as unknown as ScheduledReportRow[],
    executions: (executionsResult.data ?? []) as unknown as ReportExecutionRow[],
  };
  */
}

export default async function ReportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) redirect("/auth");

  const { data: profile } = await supabase
    .from("profiles")
    .select("org_id")
    .eq("id", user.id)
    .single();

  if (!profile?.org_id) redirect("/auth");

  const orgId = profile.org_id as string;

  const { reports, executions } = await getReportsData(orgId);

  return <ReportsClient reports={reports} executions={executions} />;
}
