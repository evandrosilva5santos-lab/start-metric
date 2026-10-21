import { NextRequest, NextResponse } from "next/server";
import { listTriageAlerts } from "@/lib/alerts/queries";
import { firstIssue, parseTriageQuery } from "@/lib/alerts/schemas";
import { jsonError, requireAlertsAuth } from "@/lib/alerts/server";

const LEGACY_COLUMNS =
  "id, org_id, rule_id, campaign_id, metric, operator, threshold, observed_value, channel, title, message, status, triggered_at, read_at, severity, acknowledged_at, resolved_at";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAlertsAuth();
  if (auth instanceof NextResponse) return auth;

  const params = request.nextUrl.searchParams;

  if (params.get("view") === "triage") {
    const parsed = parseTriageQuery(params);
    if (!parsed.success) return jsonError(firstIssue(parsed.error), 400);
    try {
      return NextResponse.json(await listTriageAlerts(auth, parsed.data));
    } catch {
      return jsonError("Não deu para carregar os alertas.", 500);
    }
  }

  const status = params.get("status") ?? "unread";
  const limitParam = Number.parseInt(params.get("limit") ?? "20", 10);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 100) : 20;

  let query = auth.supabase
    .from("alerts")
    .select(LEGACY_COLUMNS)
    .eq("org_id", auth.orgId)
    .order("triggered_at", { ascending: false })
    .limit(limit);

  if (status === "unread" || status === "read") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) return jsonError("Não deu para carregar os alertas.", 500);

  return NextResponse.json(data ?? []);
}
