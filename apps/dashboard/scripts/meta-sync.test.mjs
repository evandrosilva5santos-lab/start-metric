// Rodar de apps/dashboard: node --test scripts/meta-sync.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

const {
  BACKFILL_PRESETS,
  INCREMENTAL_PRESETS,
  classifyMetaErrorCode,
  orderSyncQueue,
  runWithinBudget,
  syncPresetsFor,
} = await import("../src/lib/meta/sync-plan.ts");
const { formatSyncAge, oldestSync, syncFailureMessage, syncProgressLabel } = await import(
  "../src/lib/meta/sync-feedback.ts"
);

const NOW = new Date("2026-10-21T15:00:00Z");
const hoursAgo = (h) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

// ---------------------------------------------------------------- janela

test("janela: conta sincronizada nas últimas 24h busca só hoje e ontem", () => {
  assert.deepEqual(syncPresetsFor(hoursAgo(0.5), NOW), INCREMENTAL_PRESETS);
  assert.deepEqual(syncPresetsFor(hoursAgo(23.9), NOW), ["today", "yesterday"]);
});

test("janela: nunca sincronizada, antiga ou data inválida refaz 30 dias e inclui hoje", () => {
  assert.deepEqual(syncPresetsFor(null, NOW), BACKFILL_PRESETS);
  assert.deepEqual(syncPresetsFor(hoursAgo(24), NOW), BACKFILL_PRESETS);
  assert.deepEqual(syncPresetsFor(hoursAgo(72), NOW), BACKFILL_PRESETS);
  assert.deepEqual(syncPresetsFor("não é data", NOW), BACKFILL_PRESETS);
  assert.ok(BACKFILL_PRESETS.includes("today"), "last_30d da Meta não inclui hoje");
  assert.ok(BACKFILL_PRESETS.includes("last_30d"));
});

test("janela: last_synced_at no futuro (relógio adiantado) conta como recente", () => {
  assert.deepEqual(syncPresetsFor(new Date(NOW.getTime() + 60_000).toISOString(), NOW), INCREMENTAL_PRESETS);
});

// ---------------------------------------------------------------- fila

test("fila: só contas ativas, nunca sincronizadas primeiro, depois as mais antigas", () => {
  const accounts = Object.freeze([
    { id: "c", status: "active", last_synced_at: hoursAgo(1) },
    { id: "hidden", status: "hidden", last_synced_at: null },
    { id: "a", status: "active", last_synced_at: null },
    { id: "expired", status: "expired", last_synced_at: hoursAgo(90) },
    { id: "b", status: "active", last_synced_at: hoursAgo(10) },
    { id: "d", status: "active", last_synced_at: "lixo" },
  ]);
  const queue = orderSyncQueue(accounts);
  assert.deepEqual(
    queue.map((a) => a.id),
    ["a", "d", "b", "c"],
  );
  assert.equal(accounts[0].id, "c", "não altera a lista recebida");
});

test("fila: empates mantêm ordem estável por id", () => {
  const queue = orderSyncQueue([
    { id: "z", status: "active", last_synced_at: null },
    { id: "m", status: "active", last_synced_at: null },
  ]);
  assert.deepEqual(queue.map((a) => a.id), ["m", "z"]);
});

// ---------------------------------------------------------------- erros da Meta

test("erros: 190 é token vencido, limites de chamada viram rate_limited", () => {
  assert.equal(classifyMetaErrorCode(190), "expired");
  for (const code of [4, 17, 613, 80000, 80004, 80014]) assert.equal(classifyMetaErrorCode(code), "rate_limited");
  for (const code of [100, 200, 500, null, undefined]) assert.equal(classifyMetaErrorCode(code), "error");
});

// ---------------------------------------------------------------- orçamento

function fakeClock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms) => (t += ms) };
}

test("orçamento: para de começar contas quando o tempo acaba e conta o restante", async () => {
  const clock = fakeClock();
  const seen = [];
  const result = await runWithinBudget(["a", "b", "c", "d", "e"], {
    budgetMs: 10_000,
    concurrency: 1,
    now: clock.now,
    worker: async (item) => {
      seen.push(item);
      clock.advance(4_000);
      return "synced";
    },
  });
  assert.deepEqual(seen, ["a", "b", "c"]);
  assert.deepEqual(result, { synced: 3, failed: 0, expired: 0, remaining: 2, durationMs: 12_000 });
});

test("orçamento: falhas e tokens vencidos contam como failed, sem derrubar o lote", async () => {
  const clock = fakeClock();
  const outcomes = { a: "synced", b: "expired", c: "error", d: "synced" };
  const result = await runWithinBudget(["a", "b", "c", "d"], {
    budgetMs: 45_000,
    concurrency: 2,
    now: clock.now,
    worker: async (item) => {
      clock.advance(100);
      if (item === "c") throw new Error("boom");
      return outcomes[item];
    },
  });
  assert.equal(result.synced, 2);
  assert.equal(result.failed, 2);
  assert.equal(result.expired, 1);
  assert.equal(result.remaining, 0);
});

test("orçamento: limite da Meta interrompe o lote e deixa o resto para a próxima rodada", async () => {
  const clock = fakeClock();
  const seen = [];
  const result = await runWithinBudget(["a", "b", "c", "d"], {
    budgetMs: 45_000,
    concurrency: 1,
    now: clock.now,
    worker: async (item) => {
      seen.push(item);
      clock.advance(100);
      return item === "b" ? "rate_limited" : "synced";
    },
  });
  assert.deepEqual(seen, ["a", "b"]);
  assert.deepEqual(result, { synced: 1, failed: 1, expired: 0, remaining: 2, durationMs: 200 });
});

test("orçamento: concorrência roda em paralelo sem passar do limite", async () => {
  let running = 0;
  let peak = 0;
  const result = await runWithinBudget([1, 2, 3, 4, 5, 6, 7], {
    budgetMs: 45_000,
    concurrency: 3,
    now: () => 0,
    worker: async () => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running -= 1;
      return "synced";
    },
  });
  assert.equal(peak, 3);
  assert.equal(result.synced, 7);
  assert.equal(result.remaining, 0);
});

test("orçamento: lista vazia devolve zeros", async () => {
  const result = await runWithinBudget([], { budgetMs: 1, concurrency: 2, now: () => 0, worker: async () => "synced" });
  assert.deepEqual(result, { synced: 0, failed: 0, expired: 0, remaining: 0, durationMs: 0 });
});

// ---------------------------------------------------------------- feedback do botão

test("idade da sincronização em português curto", () => {
  const nowMs = NOW.getTime();
  assert.equal(formatSyncAge(null, nowMs), "—");
  assert.equal(formatSyncAge("lixo", nowMs), "—");
  assert.equal(formatSyncAge(new Date(nowMs - 20_000).toISOString(), nowMs), "agora há pouco");
  assert.equal(formatSyncAge(new Date(nowMs + 60_000).toISOString(), nowMs), "agora há pouco");
  assert.equal(formatSyncAge(new Date(nowMs - 12 * 60_000).toISOString(), nowMs), "há 12 min");
  assert.equal(formatSyncAge(hoursAgo(3), nowMs), "há 3 h");
  assert.equal(formatSyncAge(hoursAgo(25), nowMs), "há 1 dia");
  assert.equal(formatSyncAge(hoursAgo(72), nowMs), "há 3 dias");
});

test("escopo: usa a sincronização mais antiga entre as contas que já sincronizaram", () => {
  assert.equal(oldestSync([]), null);
  assert.equal(oldestSync([null, null]), null);
  assert.equal(oldestSync([hoursAgo(1), null, hoursAgo(5), "lixo"]), hoursAgo(5));
});

test("progresso do botão", () => {
  assert.equal(syncProgressLabel(1, 1), "Sincronizando…");
  assert.equal(syncProgressLabel(2, 3), "Sincronizando 2 de 3…");
});

test("mensagens de falha legíveis por status e código", () => {
  assert.match(syncFailureMessage({ status: 401 }), /sessão/i);
  assert.match(syncFailureMessage({ status: 404 }), /não encontrada/i);
  assert.match(syncFailureMessage({ status: 429 }), /limitou/i);
  assert.match(syncFailureMessage({ status: 200, code: "rate_limited" }), /limitou/i);
  assert.match(syncFailureMessage({ status: 200, code: "expired" }), /expirou/i);
  assert.match(syncFailureMessage({ status: 400, error: "Conta desconectada. Reconecte para sincronizar." }), /desconectada/);
  assert.match(syncFailureMessage({ status: 500 }), /tente de novo/i);
  assert.match(syncFailureMessage({ status: 0 }), /conexão/i);
});
