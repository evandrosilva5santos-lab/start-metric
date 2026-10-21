import "server-only";

import { createPartDataSource, loadAccounts, loadReportForGeneration, type ReportsDb } from "@/lib/reports/data";
import { isUniqueViolation, runGeneration, type GenerationResult, type GenerationStore } from "@/lib/reports/generate-core";

export interface GenerateReportRunInput {
  reportId: string;
  orgId: string;
  scheduledFor: Date;
  supabaseAdmin: ReportsDb;
}

export function truncateToMinute(date: Date): Date {
  const copy = new Date(date.getTime());
  copy.setUTCSeconds(0, 0);
  return copy;
}

export async function generateReportRun({ reportId, orgId, scheduledFor, supabaseAdmin: db }: GenerateReportRunInput): Promise<GenerationResult> {
  const store: GenerationStore = {
    ...createPartDataSource(db, orgId),
    async insertRun() {
      const { data, error } = await db
        .from("report_runs")
        .insert({
          org_id: orgId,
          report_id: reportId,
          scheduled_for: scheduledFor.toISOString(),
          status: "queued",
          started_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (isUniqueViolation(error)) return { inserted: false };
      if (error || !data) throw new Error(`Falha ao registrar a geração: ${error?.message ?? "sem retorno"}`);
      return { inserted: true, runId: data.id };
    },
    loadReport: () => loadReportForGeneration(db, orgId, reportId),
    loadAccounts: (report) =>
      loadAccounts(
        db,
        orgId,
        report.clientId,
        report.parts.flatMap((p) => (p.adAccountId ? [p.adAccountId] : [])),
      ),
    async finishRun(runId, patch) {
      const { error } = await db
        .from("report_runs")
        .update({
          status: patch.status,
          rendered_body: patch.renderedBody,
          missing_variables: patch.missing,
          error_message: patch.errorMessage,
          finished_at: new Date().toISOString(),
        })
        .eq("id", runId)
        .eq("org_id", orgId);
      if (error) throw new Error(`Falha ao concluir a geração: ${error.message}`);
    },
  };

  return runGeneration(store, { now: scheduledFor });
}
