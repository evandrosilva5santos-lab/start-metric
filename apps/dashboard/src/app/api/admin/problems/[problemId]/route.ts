import { NextResponse } from "next/server";
import { requireAdminOrgContext } from "@/lib/admin/context";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getTrimmedString,
  integerOrNull,
  optionalTrimmedString,
  readBodyObject,
} from "@/lib/admin/validation";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ problemId: string }> },
): Promise<NextResponse> {
  const auth = await requireAdminOrgContext();
  if (!auth.ok) {
    return auth.error;
  }

  const { problemId } = await context.params;
  if (!problemId) {
    return NextResponse.json({ error: "problemId é obrigatório" }, { status: 400 });
  }

  let bodyRaw: unknown;
  try {
    bodyRaw = await request.json();
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const body = readBodyObject(bodyRaw);
  if (!body) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const statusRaw = optionalTrimmedString(body.status);
  const severityRaw = optionalTrimmedString(body.severity);
  const resolutionNotes = optionalTrimmedString(body.resolutionNotes);
  const occurrences = integerOrNull(body.occurrences);
  const lastSeenAt = optionalTrimmedString(body.lastSeenAt);

  const updates: Record<string, unknown> = {};

  if (statusRaw) {
    if (!["open", "investigating", "resolved", "ignored"].includes(statusRaw)) {
      return NextResponse.json({ error: "status inválido" }, { status: 422 });
    }
    updates.status = statusRaw;
  }

  if (severityRaw) {
    if (!["low", "medium", "high", "critical"].includes(severityRaw)) {
      return NextResponse.json({ error: "severity inválida" }, { status: 422 });
    }
    updates.severity = severityRaw;
  }

  if (resolutionNotes !== null) {
    updates.resolution_notes = resolutionNotes;
  }

  if (occurrences !== null) {
    updates.occurrences = Math.max(1, occurrences);
  }

  if (lastSeenAt) {
    const parsed = new Date(lastSeenAt);
    if (Number.isNaN(parsed.getTime())) {
      return NextResponse.json({ error: "lastSeenAt inválido" }, { status: 422 });
    }
    updates.last_seen_at = parsed.toISOString();
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nenhum campo válido para atualizar" }, { status: 422 });
  }

  if (!updates.last_seen_at && (updates.status === "investigating" || updates.status === "resolved")) {
    updates.last_seen_at = new Date().toISOString();
  }

  const adminClient = createAdminClient();

  const { data, error } = await adminClient
    .from("admin_problem_reports")
    .update(updates)
    .eq("id", problemId)
    .eq("org_id", auth.context.orgId)
    .select(
      "id, user_id, log_id, title, severity, status, symptom, root_cause, detailed_analysis, impact, resolution_notes, first_seen_at, last_seen_at, occurrences, created_at, updated_at",
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Problema não encontrado" }, { status: 404 });
  }

  const statusLabel = getTrimmedString((updates.status as string | undefined) ?? "");
  const { error: logError } = await adminClient.from("admin_user_logs").insert({
    org_id: auth.context.orgId,
    user_id: data.user_id,
    actor_user_id: auth.context.userId,
    level: "info",
    event: "admin_problem_updated",
    root_cause: "Atualização manual de incidente no painel administrativo.",
    detailed_analysis: `Problema ${problemId} atualizado${statusLabel ? ` para status ${statusLabel}` : ""}.`,
    source: "admin_panel",
    context_json: {
      problemId,
      updatedFields: Object.keys(updates),
    },
  });

  if (logError) {
    console.error("[admin/problems] failed to write update log", logError.message);
  }

  return NextResponse.json({ problem: data });
}
