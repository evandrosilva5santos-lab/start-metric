import { NextRequest, NextResponse } from "next/server";
import { requireAdminOrgContext } from "@/lib/admin/context";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getTrimmedString,
  integerOrNull,
  optionalTrimmedString,
  readBodyObject,
} from "@/lib/admin/validation";
import type { AdminProblem } from "@/lib/admin/types";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdminOrgContext();
  if (!auth.ok) {
    return auth.error;
  }

  const searchParams = request.nextUrl.searchParams;
  const statusFilter = optionalTrimmedString(searchParams.get("status"));
  const severityFilter = optionalTrimmedString(searchParams.get("severity"));
  const limitRaw = Number(searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitRaw)
    ? Math.max(1, Math.min(200, Math.round(limitRaw)))
    : 50;

  const adminClient = createAdminClient();

  let query = adminClient
    .from("admin_problem_reports")
    .select(
      "id, user_id, log_id, title, severity, status, symptom, root_cause, detailed_analysis, impact, resolution_notes, first_seen_at, last_seen_at, occurrences, created_at, updated_at",
    )
    .eq("org_id", auth.context.orgId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (statusFilter) {
    query = query.eq("status", statusFilter);
  }

  if (severityFilter) {
    query = query.eq("severity", severityFilter);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const problems = (data ?? []) as unknown as AdminProblem[];
  const userIds = Array.from(new Set(problems.map((problem) => problem.user_id).filter(Boolean))) as string[];
  const logIds = Array.from(new Set(problems.map((problem) => problem.log_id).filter(Boolean))) as string[];

  const userMap = new Map<string, string>();
  const logEventMap = new Map<string, string>();

  if (userIds.length > 0) {
    const { data: profiles } = await adminClient.from("profiles").select("id, name").in("id", userIds);
    for (const profile of profiles ?? []) {
      if (profile.id) {
        userMap.set(profile.id as string, (profile.name as string | null) ?? "Sem nome");
      }
    }
  }

  if (logIds.length > 0) {
    const { data: logs } = await adminClient.from("admin_user_logs").select("id, event").in("id", logIds);
    for (const log of logs ?? []) {
      if (log.id) {
        logEventMap.set(log.id as string, (log.event as string | null) ?? "evento-desconhecido");
      }
    }
  }

  const normalized = problems.map((problem) => ({
    ...problem,
    user_name: problem.user_id ? userMap.get(problem.user_id) ?? null : null,
    log_event: problem.log_id ? logEventMap.get(problem.log_id) ?? null : null,
  }));

  return NextResponse.json({ problems: normalized });
}

export async function POST(request: Request): Promise<NextResponse> {
  const auth = await requireAdminOrgContext();
  if (!auth.ok) {
    return auth.error;
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

  const title = getTrimmedString(body.title);
  const severityRaw = getTrimmedString(body.severity) || "medium";
  const statusRaw = getTrimmedString(body.status) || "open";
  const symptom = getTrimmedString(body.symptom);
  const rootCause = getTrimmedString(body.rootCause);
  const detailedAnalysis = getTrimmedString(body.detailedAnalysis);
  const impact = getTrimmedString(body.impact);
  const resolutionNotes = optionalTrimmedString(body.resolutionNotes);
  const userId = optionalTrimmedString(body.userId);
  const logId = optionalTrimmedString(body.logId);
  const occurrences = integerOrNull(body.occurrences) ?? 1;

  if (!title || !symptom || !rootCause || !detailedAnalysis || !impact) {
    return NextResponse.json(
      {
        error:
          "Campos obrigatórios: title, symptom, rootCause, detailedAnalysis e impact.",
      },
      { status: 422 },
    );
  }

  const severity = (["low", "medium", "high", "critical"] as const).includes(
    severityRaw as "low" | "medium" | "high" | "critical",
  )
    ? (severityRaw as "low" | "medium" | "high" | "critical")
    : "medium";

  const status = (["open", "investigating", "resolved", "ignored"] as const).includes(
    statusRaw as "open" | "investigating" | "resolved" | "ignored",
  )
    ? (statusRaw as "open" | "investigating" | "resolved" | "ignored")
    : "open";

  const adminClient = createAdminClient();

  if (userId) {
    const { data: userProfile } = await adminClient
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .eq("org_id", auth.context.orgId)
      .single();

    if (!userProfile?.id) {
      return NextResponse.json({ error: "Usuário informado não pertence à organização" }, { status: 422 });
    }
  }

  if (logId) {
    const { data: logRow } = await adminClient
      .from("admin_user_logs")
      .select("id")
      .eq("id", logId)
      .eq("org_id", auth.context.orgId)
      .single();

    if (!logRow?.id) {
      return NextResponse.json({ error: "Log informado não pertence à organização" }, { status: 422 });
    }
  }

  const now = new Date().toISOString();

  const { data, error } = await adminClient
    .from("admin_problem_reports")
    .insert({
      org_id: auth.context.orgId,
      user_id: userId,
      log_id: logId,
      title,
      severity,
      status,
      symptom,
      root_cause: rootCause,
      detailed_analysis: detailedAnalysis,
      impact,
      resolution_notes: resolutionNotes,
      first_seen_at: now,
      last_seen_at: now,
      occurrences: Math.max(1, occurrences),
      created_by: auth.context.userId,
    })
    .select(
      "id, user_id, log_id, title, severity, status, symptom, root_cause, detailed_analysis, impact, resolution_notes, first_seen_at, last_seen_at, occurrences, created_at, updated_at",
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ problem: data }, { status: 201 });
}
