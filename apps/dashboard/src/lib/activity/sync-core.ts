// Núcleo da sincronização do histórico da Meta para uma conta. Sem rede nem banco aqui:
// a rota injeta a Graph, a gravação e a cobertura (padrão de reports/generate-core).
// Cada janela é buscada inteira antes de gerar as chaves (o ordinal precisa ver o segundo todo);
// dia acima do teto de páginas é dividido em janelas menores até 1 h.

import { classifyActivity, CLASSIFIER_VERSION } from "./classify";
import { describeActivity } from "./format/describe";
import { assignDedupeKeys } from "./meta/dedupe";
import { normalizeMetaActivity } from "./meta/normalize";
import { dayWindow, splitWindow, type ActivityWindow } from "./meta/window";
import type { RawMetaActivity } from "./types";

export type FailureKind = "expired" | "rate_limited" | "error";

export type ActivityPage = { events: RawMetaActivity[]; after: string | null };

export type ActivityRow = Record<string, unknown> & { dedupe_key: string };

export type SyncDeps = {
  fetchActivities: (accountExternalId: string, since: number, until: number, after: string | null) => Promise<ActivityPage>;
  insertRows: (rows: ActivityRow[]) => Promise<{ inserted: number; skipped: number }>;
  recordCoverage: (day: string, status: "complete" | "partial", events: number) => Promise<void>;
  heartbeat: (fetched: number, inserted: number, duplicates: number) => Promise<boolean>;
  now: () => number;
  failureKind: (err: unknown) => FailureKind;
};

export type SyncAccount = { id: string; externalId: string; timezone: string };

export type SyncOptions = {
  days: string[];
  budgetMs: number;
  maxPagesPerWindow: number;
  startMetricAppId: string | null;
};

export type SyncResult = {
  status: "succeeded" | "partial" | "failed";
  fetched: number;
  inserted: number;
  duplicates: number;
  daysComplete: string[];
  errorCode: string | null;
  errorMessage: string | null;
};

const INSERT_CHUNK = 500;
const URL_IN_TEXT = /https?:[^"\s]*/g;

class TooManyEventsError extends Error {}
class StaleRunError extends Error {}
class BudgetExceededError extends Error {}

const clip = (text: string | null | undefined, max: number) => (text ? text.slice(0, max) : null);

/** Payload guardado como evidência: sem URLs assinadas da CDN. */
function sanitizeRaw(raw: RawMetaActivity): Record<string, unknown> {
  return {
    ...raw,
    object_name: raw.object_name?.replace(URL_IN_TEXT, "[url]"),
    extra_data: raw.extra_data?.replace(URL_IN_TEXT, "[url]"),
  };
}

export function buildActivityRows(rawEvents: RawMetaActivity[], account: SyncAccount, startMetricAppId: string | null): ActivityRow[] {
  const normalized = rawEvents.map((raw) => normalizeMetaActivity(raw, { accountExternalId: account.externalId, startMetricAppId }));
  return assignDedupeKeys(normalized).map((n, index) => {
    const classification = classifyActivity(n);
    const description = describeActivity(n);
    return {
      dedupe_key: n.dedupeKey,
      source: "meta",
      source_app: clip(n.appName, 200),
      event_type: n.eventType,
      action: classification.action,
      category: classification.category,
      counts_as_work: classification.countsAsWork,
      classifier_version: CLASSIFIER_VERSION,
      object_level: n.objectLevel,
      object_external_id: n.objectExternalId,
      object_name: clip(n.objectName, 500),
      campaign_external_id: n.campaignExternalId,
      ad_set_external_id: n.adSetExternalId,
      account_external_id: account.externalId,
      ad_account_id: account.id,
      title: clip(description.title, 300),
      description: clip(description.detail, 4000),
      occurred_at: n.occurredAt,
      actor_kind: n.actorKind,
      actor_name: clip(n.actorName, 200),
      actor_external_id: n.actorExternalId,
      status: "succeeded",
      before: n.before,
      after: n.after,
      visibility: classification.countsAsWork ? "client" : "internal",
      raw: n.actorKind === "platform" ? null : sanitizeRaw(rawEvents[index]),
    };
  });
}

export async function syncAccountActivity(deps: SyncDeps, account: SyncAccount, options: SyncOptions): Promise<SyncResult> {
  const startedAt = deps.now();
  const totals = { fetched: 0, inserted: 0, duplicates: 0 };
  const daysComplete: string[] = [];

  async function fetchWindow(window: ActivityWindow): Promise<RawMetaActivity[] | null> {
    const events: RawMetaActivity[] = [];
    let after: string | null = null;
    let pages = 0;
    do {
      if (deps.now() - startedAt > options.budgetMs) throw new BudgetExceededError("tempo da execução esgotado");
      const page: ActivityPage = await deps.fetchActivities(account.externalId, window.since, window.until, after);
      events.push(...page.events);
      after = page.after;
      pages++;
      if (after && pages >= options.maxPagesPerWindow) return null;
    } while (after);
    return events;
  }

  async function collectWindows(window: ActivityWindow): Promise<RawMetaActivity[][]> {
    const events = await fetchWindow(window);
    if (events) return [events];
    const halves = splitWindow(window);
    if (!halves) throw new TooManyEventsError("janela de 1 h acima do teto de páginas");
    return [...(await collectWindows(halves[0])), ...(await collectWindows(halves[1]))];
  }

  async function storeWindow(events: RawMetaActivity[]): Promise<void> {
    const rows = buildActivityRows(events, account, options.startMetricAppId);
    totals.fetched += rows.length;
    for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
      const result = await deps.insertRows(rows.slice(i, i + INSERT_CHUNK));
      totals.inserted += result.inserted;
      totals.duplicates += result.skipped;
    }
    if (!(await deps.heartbeat(totals.fetched, totals.inserted, totals.duplicates))) throw new StaleRunError("execução marcada como parada");
  }

  const finish = (status: SyncResult["status"], errorCode: string | null = null, errorMessage: string | null = null): SyncResult => ({
    status,
    ...totals,
    daysComplete,
    errorCode,
    errorMessage,
  });

  for (const day of options.days) {
    if (deps.now() - startedAt > options.budgetMs) return finish("partial", "budget", "tempo da execução esgotado");
    try {
      const windows = await collectWindows(dayWindow(day, account.timezone));
      let dayEvents = 0;
      for (const events of windows) {
        await storeWindow(events);
        dayEvents += events.length;
      }
      await deps.recordCoverage(day, "complete", dayEvents);
      daysComplete.push(day);
    } catch (err) {
      if (err instanceof TooManyEventsError) {
        await deps.recordCoverage(day, "partial", 0);
        continue;
      }
      if (err instanceof StaleRunError) return finish("failed", "stale", err.message);
      if (err instanceof BudgetExceededError) return finish("partial", "budget", err.message);
      const kind = deps.failureKind(err);
      const message = err instanceof Error ? err.message : "erro desconhecido";
      return kind === "expired" ? finish("failed", "expired", message) : finish("partial", kind, message);
    }
  }
  return finish("succeeded");
}
