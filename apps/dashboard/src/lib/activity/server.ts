// Server-side ONLY. Liga o núcleo da sincronização (sync-core) à Graph API e ao banco.
// Toda escrita passa pelas funções RPC com a org explícita (o painel usa service role).

import type { SupabaseClient } from "@supabase/supabase-js";
import { MetaApiError } from "@/lib/meta/client";
import { createTokenResolver, markAccountExpired, metaFailureKind, type SyncTarget } from "@/lib/meta/sync-account";
import { parseGraphText } from "./meta/parse";
import { addDays, localDay, planSyncDays } from "./meta/window";
import { syncAccountActivity, type ActivityPage, type ActivityRow, type SyncResult } from "./sync-core";
import type { RawMetaActivity } from "./types";

// As tabelas e funções da Central ainda não estão nos tipos gerados do Supabase.
type Db = SupabaseClient;

export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

const GRAPH_API_BASE = "https://graph.facebook.com/v20.0";
const FIELDS = [
  "event_type",
  "translated_event_type",
  "event_time",
  "actor_id",
  "actor_name",
  "application_id",
  "application_name",
  "object_id",
  "object_name",
  "object_type",
  "extra_data",
].join(",");
const PAGE_SIZE = "100";
const REQUEST_TIMEOUT_MS = 20_000;
const LOOKBACK_DAYS = 30;

export type ActivityAccount = SyncTarget & { timezone: string | null };

type GraphActivityResponse = {
  data?: RawMetaActivity[];
  paging?: { cursors?: { after?: string }; next?: string };
  error?: { message: string; code: number };
};

async function fetchActivityPage(token: string, accountExternalId: string, since: number, until: number, after: string | null): Promise<ActivityPage> {
  const url = new URL(`${GRAPH_API_BASE}/${accountExternalId}/activities`);
  url.searchParams.set("fields", FIELDS);
  url.searchParams.set("since", String(since));
  url.searchParams.set("until", String(until));
  url.searchParams.set("limit", PAGE_SIZE);
  url.searchParams.set("locale", "pt_BR");
  url.searchParams.set("access_token", token);
  if (after) url.searchParams.set("after", after);

  const res = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), cache: "no-store" });
  const body = parseGraphText<GraphActivityResponse>(await res.text());
  if (body.error) throw new MetaApiError(body.error.message, body.error.code);
  if (!res.ok) throw new MetaApiError(`Graph respondeu ${res.status}`, res.status);
  return { events: body.data ?? [], after: body.paging?.next ? (body.paging.cursors?.after ?? null) : null };
}

async function completeDays(db: Db, account: ActivityAccount, fromDay: string): Promise<Set<string>> {
  const { data, error } = await db
    .from("activity_sync_coverage")
    .select("day")
    .eq("org_id", account.org_id)
    .eq("ad_account_id", account.id)
    .eq("status", "complete")
    .gte("day", fromDay);
  if (error) throw new Error(`cobertura: ${error.message}`);
  return new Set((data ?? []).map((row: { day: string }) => row.day));
}

export type AccountSyncOutcome =
  | { accountId: string; skipped: "running" | "rate_limited" }
  | { accountId: string; result: SyncResult };

type SyncOptions = { trigger: "cron" | "manual"; budgetMs: number; maxDays: number };

export async function syncAccountHistory(
  db: Db,
  account: ActivityAccount,
  resolveToken: ReturnType<typeof createTokenResolver>,
  options: SyncOptions,
): Promise<AccountSyncOutcome> {
  const { data: acquired, error: acquireError } = await db.rpc("acquire_activity_sync_run", {
    p_org_id: account.org_id,
    p_ad_account_id: account.id,
    p_trigger: options.trigger,
  });
  if (acquireError) throw new Error(`trava: ${acquireError.message}`);
  const lock = (acquired as Array<{ run_id: string | null; reason: string }>)[0];
  if (!lock?.run_id) return { accountId: account.id, skipped: lock?.reason === "rate_limited" ? "rate_limited" : "running" };
  const runId = lock.run_id;

  const finish = async (result: SyncResult) => {
    await db.rpc("finish_activity_sync_run", {
      p_run_id: runId,
      p_status: result.status,
      p_fetched: result.fetched,
      p_inserted: result.inserted,
      p_duplicates: result.duplicates,
      p_error_code: result.errorCode,
      p_error_message: result.errorMessage,
    });
    return { accountId: account.id, result };
  };

  const resolved = await resolveToken(account);
  if (!resolved) {
    return finish({ status: "failed", fetched: 0, inserted: 0, duplicates: 0, daysComplete: [], errorCode: "no_token", errorMessage: "conta sem token da Meta" });
  }

  const timezone = account.timezone || DEFAULT_TIMEZONE;
  const today = localDay(Math.floor(Date.now() / 1000), timezone);
  const done = await completeDays(db, account, addDays(today, -LOOKBACK_DAYS));
  const days = planSyncDays({ today, lookbackDays: LOOKBACK_DAYS, completeDays: done, maxDays: options.maxDays });

  const result = await syncAccountActivity(
    {
      fetchActivities: (externalId, since, until, after) => fetchActivityPage(resolved.token, externalId, since, until, after),
      insertRows: async (rows: ActivityRow[]) => {
        const { data, error } = await db.rpc("insert_activity_events", { p_org_id: account.org_id, p_rows: rows });
        if (error) throw new Error(`gravação: ${error.message}`);
        const counts = (data as Array<{ inserted: number; skipped: number }>)[0];
        return { inserted: counts?.inserted ?? 0, skipped: counts?.skipped ?? 0 };
      },
      recordCoverage: async (day, status, events) => {
        const { error } = await db.rpc("record_activity_coverage", {
          p_org_id: account.org_id,
          p_ad_account_id: account.id,
          p_day: day,
          p_status: status,
          p_events: events,
        });
        if (error) throw new Error(`cobertura: ${error.message}`);
      },
      heartbeat: async (fetched, inserted, duplicates) => {
        const { data } = await db.rpc("heartbeat_activity_sync_run", {
          p_run_id: runId,
          p_fetched: fetched,
          p_inserted: inserted,
          p_duplicates: duplicates,
        });
        return data === true;
      },
      now: Date.now,
      failureKind: metaFailureKind,
    },
    { id: account.id, externalId: account.external_id, timezone },
    { days, budgetMs: options.budgetMs, maxPagesPerWindow: 20, startMetricAppId: process.env.META_APP_ID ?? null },
  );

  if (result.errorCode === "expired") await markAccountExpired(db as never, account, resolved.tokenEncrypted);
  return finish(result);
}

/** Sincroniza contas em sequência até acabar o orçamento de tempo. */
export async function syncAccountsHistory(db: Db, accounts: ActivityAccount[], options: SyncOptions): Promise<AccountSyncOutcome[]> {
  const resolveToken = createTokenResolver(db as never);
  const startedAt = Date.now();
  const outcomes: AccountSyncOutcome[] = [];
  for (const account of accounts) {
    const remaining = options.budgetMs - (Date.now() - startedAt);
    if (remaining < 5_000) break;
    try {
      outcomes.push(await syncAccountHistory(db, account, resolveToken, { ...options, budgetMs: remaining - 3_000 }));
    } catch (err) {
      console.error(`[activity/sync] Conta ${account.external_id}:`, err instanceof Error ? err.message : err);
    }
  }
  return outcomes;
}
