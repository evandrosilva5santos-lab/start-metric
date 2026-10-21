export const FRESH_SYNC_WINDOW_MS = 24 * 60 * 60 * 1000;
export const INCREMENTAL_PRESETS: readonly string[] = Object.freeze(["today", "yesterday"]);
export const BACKFILL_PRESETS: readonly string[] = Object.freeze(["today", "last_30d"]);
export const SYNCABLE_STATUS = "active";

const TOKEN_EXPIRED_CODE = 190;
const RATE_LIMIT_CODES = new Set([4, 17, 613]);
const ADS_THROTTLE_MIN = 80000;
const ADS_THROTTLE_MAX = 80014;

export type SyncCandidate = { id: string; status: string; last_synced_at: string | null };
export type MetaFailureKind = "expired" | "rate_limited" | "error";
export type SyncOutcome = "synced" | MetaFailureKind;

export type BatchResult = {
  synced: number;
  failed: number;
  expired: number;
  remaining: number;
  durationMs: number;
};

export type BudgetOptions<T> = {
  budgetMs: number;
  concurrency: number;
  now: () => number;
  worker: (item: T) => Promise<SyncOutcome>;
};

function timeOf(iso: string | null): number | null {
  if (!iso) return null;
  const time = Date.parse(iso);
  return Number.isFinite(time) ? time : null;
}

export function syncPresetsFor(lastSyncedAt: string | null, now: Date): readonly string[] {
  const last = timeOf(lastSyncedAt);
  if (last === null) return BACKFILL_PRESETS;
  return now.getTime() - last < FRESH_SYNC_WINDOW_MS ? INCREMENTAL_PRESETS : BACKFILL_PRESETS;
}

export function orderSyncQueue<T extends SyncCandidate>(accounts: readonly T[]): T[] {
  return accounts
    .filter((account) => account.status === SYNCABLE_STATUS)
    .map((account) => ({ account, time: timeOf(account.last_synced_at) }))
    .sort((a, b) => {
      if (a.time !== b.time) {
        if (a.time === null) return -1;
        if (b.time === null) return 1;
        return a.time - b.time;
      }
      return a.account.id.localeCompare(b.account.id);
    })
    .map(({ account }) => account);
}

export function classifyMetaErrorCode(code: number | null | undefined): MetaFailureKind {
  if (code === TOKEN_EXPIRED_CODE) return "expired";
  if (typeof code !== "number") return "error";
  if (RATE_LIMIT_CODES.has(code) || (code >= ADS_THROTTLE_MIN && code <= ADS_THROTTLE_MAX)) return "rate_limited";
  return "error";
}

export async function runWithinBudget<T>(items: readonly T[], options: BudgetOptions<T>): Promise<BatchResult> {
  const { budgetMs, concurrency, now, worker } = options;
  const startedAt = now();
  const counts = { synced: 0, failed: 0, expired: 0, started: 0 };
  let halted = false;

  const canStart = () => !halted && counts.started < items.length && now() - startedAt < budgetMs;

  async function lane(): Promise<void> {
    while (canStart()) {
      const item = items[counts.started];
      counts.started += 1;
      let outcome: SyncOutcome;
      try {
        outcome = await worker(item);
      } catch {
        outcome = "error";
      }
      if (outcome === "synced") {
        counts.synced += 1;
        continue;
      }
      counts.failed += 1;
      if (outcome === "expired") counts.expired += 1;
      if (outcome === "rate_limited") halted = true;
    }
  }

  const lanes = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: lanes }, () => lane()));

  return {
    synced: counts.synced,
    failed: counts.failed,
    expired: counts.expired,
    remaining: items.length - counts.started,
    durationMs: now() - startedAt,
  };
}
