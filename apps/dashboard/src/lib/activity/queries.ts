// Server-side ONLY. Leitura do histórico de um cliente: sempre filtrada por org e cliente.

import type { SupabaseClient } from "@supabase/supabase-js";
import { groupBursts } from "./group";
import { addDays, zonedDayStartUtc } from "./meta/window";
import { DEFAULT_TIMEZONE } from "./server";

type Db = SupabaseClient;

const PAGE = 1000;
const MAX_EVENTS = 5000;
const MAX_NAMES = 3;

export type ActivityOrigin = "meta" | "integration" | "platform" | "system" | "manual";

export type ActivityItem = {
  id: string;
  startedAt: string;
  endedAt: string;
  title: string;
  detail: string | null;
  count: number;
  objectNames: string[];
  moreObjects: number;
  origin: ActivityOrigin;
  actorName: string | null;
  appName: string | null;
  category: string;
  countsAsWork: boolean;
};

type EventRow = {
  id: string;
  occurred_at: string;
  title: string;
  description: string | null;
  object_name: string | null;
  source: string;
  actor_kind: string;
  actor_name: string | null;
  actor_external_id: string | null;
  source_app: string | null;
  action: string;
  category: string;
  counts_as_work: boolean;
};

export type ClientAccount = { id: string; external_id: string; name: string | null; timezone: string | null };

export async function clientAccounts(db: Db, orgId: string, clientId: string): Promise<ClientAccount[]> {
  const { data, error } = await db
    .from("ad_accounts")
    .select("id, external_id, name, timezone")
    .eq("org_id", orgId)
    .eq("client_id", clientId)
    .eq("platform", "meta")
    .neq("status", "hidden");
  if (error) throw new Error(`contas: ${error.message}`);
  return (data ?? []) as ClientAccount[];
}

export const clientTimezone = (accounts: ClientAccount[]) => accounts.find((a) => a.timezone)?.timezone ?? DEFAULT_TIMEZONE;

function originOf(row: EventRow): ActivityOrigin {
  if (row.source === "manual") return "manual";
  if (row.source === "system") return "system";
  if (row.actor_kind === "platform") return "platform";
  if (row.actor_kind === "integration") return "integration";
  return "meta";
}

export async function listClientActivity(
  db: Db,
  params: { orgId: string; clientId: string; from: string; to: string; timezone: string; scope: "work" | "all" },
): Promise<{ items: ActivityItem[]; totalEvents: number; truncated: boolean }> {
  const startIso = new Date(zonedDayStartUtc(params.from, params.timezone) * 1000).toISOString();
  const endIso = new Date(zonedDayStartUtc(addDays(params.to, 1), params.timezone) * 1000).toISOString();

  const rows: EventRow[] = [];
  for (let offset = 0; offset < MAX_EVENTS; offset += PAGE) {
    let query = db
      .from("activity_events")
      .select("id, occurred_at, title, description, object_name, source, actor_kind, actor_name, actor_external_id, source_app, action, category, counts_as_work")
      .eq("org_id", params.orgId)
      .eq("client_id", params.clientId)
      .is("voided_at", null)
      .gte("occurred_at", startIso)
      .lt("occurred_at", endIso)
      .order("occurred_at", { ascending: false })
      .range(offset, offset + PAGE - 1);
    if (params.scope === "work") query = query.eq("counts_as_work", true);
    const { data, error } = await query;
    if (error) throw new Error(`histórico: ${error.message}`);
    rows.push(...((data ?? []) as EventRow[]));
    if (!data || data.length < PAGE) break;
  }

  const bursts = groupBursts(
    rows.map((row) => ({ ...row, occurredAt: row.occurred_at, actorKey: row.actor_external_id ?? row.actor_kind })),
  );
  const items = bursts.map(({ first, events, startedAt, endedAt }) => {
    const names = [...new Set(events.map((e) => e.object_name).filter((n): n is string => !!n))];
    return {
      id: first.id,
      startedAt,
      endedAt,
      title: first.title,
      detail: events.length === 1 ? first.description : null,
      count: events.length,
      objectNames: names.slice(0, MAX_NAMES),
      moreObjects: Math.max(0, names.length - MAX_NAMES),
      origin: originOf(first),
      actorName: first.actor_kind === "platform" ? "Meta" : first.actor_name,
      appName: first.source_app,
      category: first.category,
      countsAsWork: first.counts_as_work,
    };
  });
  return { items, totalEvents: rows.length, truncated: rows.length >= MAX_EVENTS };
}

export type SyncStatus = {
  lastSyncedAt: string | null;
  running: boolean;
  lastError: { code: string | null; at: string } | null;
  daysComplete: number;
  daysTotal: number;
};

export async function clientSyncStatus(db: Db, orgId: string, accounts: ClientAccount[], from: string, to: string): Promise<SyncStatus> {
  const ids = accounts.map((a) => a.id);
  if (ids.length === 0) return { lastSyncedAt: null, running: false, lastError: null, daysComplete: 0, daysTotal: 0 };

  const [runs, coverage] = await Promise.all([
    db
      .from("activity_sync_runs")
      .select("status, finished_at, error_code, started_at")
      .eq("org_id", orgId)
      .in("ad_account_id", ids)
      .order("started_at", { ascending: false })
      .limit(ids.length * 4),
    db
      .from("activity_sync_coverage")
      .select("ad_account_id, day, status")
      .eq("org_id", orgId)
      .in("ad_account_id", ids)
      .gte("day", from)
      .lte("day", to),
  ]);
  if (runs.error) throw new Error(`execuções: ${runs.error.message}`);
  if (coverage.error) throw new Error(`cobertura: ${coverage.error.message}`);

  const runRows = (runs.data ?? []) as Array<{ status: string; finished_at: string | null; error_code: string | null; started_at: string }>;
  const finished = runRows.find((r) => r.status === "succeeded" || r.status === "partial");
  const failed = runRows.find((r) => r.status === "failed");
  let daysTotal = 0;
  for (let day = from; day <= to; day = addDays(day, 1)) daysTotal++;

  return {
    lastSyncedAt: finished?.finished_at ?? null,
    running: runRows.some((r) => r.status === "running"),
    lastError: failed && (!finished || failed.started_at > finished.started_at) ? { code: failed.error_code, at: failed.started_at } : null,
    daysComplete: ((coverage.data ?? []) as Array<{ status: string }>).filter((c) => c.status === "complete").length,
    daysTotal: daysTotal * ids.length,
  };
}
