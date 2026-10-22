// Rodar de apps/dashboard: node --test scripts/reports-generation.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const { resolvePeriod, localDateIn, isValidTimeZone } = await import("../src/lib/reports/period.ts");
const { computeNextRunAt } = await import("../src/lib/reports/schedule.ts");
const { runGeneration, renderLivePart, templateNeeds, redactSecrets, isUniqueViolation, selectPartAccounts } = await import(
  "../src/lib/reports/generate-core.ts"
);
const { createReportSchema, updateReportSchema, previewSchema, deliverySchema, scheduleSchema } = await import(
  "../src/lib/reports/schema.ts"
);

const plain = (s) => s.replace(/\u00a0/g, " ");

// ---------------------------------------------------------------- período

test("período: ontem no fuso de São Paulo, mesmo quando em UTC já é o dia seguinte", () => {
  // 16/10 02:00 UTC = 15/10 23:00 em São Paulo
  const now = new Date("2026-10-16T02:00:00Z");
  assert.equal(localDateIn(now, "America/Sao_Paulo"), "2026-10-15");
  assert.deepEqual(resolvePeriod({ period: "yesterday" }, now), {
    since: "2026-10-14",
    until: "2026-10-14",
    startDate: "14/10/2026",
    endDate: "14/10/2026",
  });
  assert.equal(resolvePeriod({ period: "yesterday" }, now, "UTC").since, "2026-10-15");
});

test("período: últimos 7 e 30 dias terminam ontem", () => {
  const now = new Date("2026-10-16T12:00:00Z");
  assert.deepEqual(
    { ...resolvePeriod({ period: "last_7d" }, now) },
    { since: "2026-10-09", until: "2026-10-15", startDate: "09/10/2026", endDate: "15/10/2026" },
  );
  const r30 = resolvePeriod({ period: "last_30d" }, now);
  assert.equal(r30.since, "2026-09-16");
  assert.equal(r30.until, "2026-10-15");
});

test("período: este mês e mês passado nas viradas de mês e de ano", () => {
  // 01/03 01:00 UTC ainda é 28/02 em São Paulo (2026 não é bissexto)
  const now = new Date("2026-03-01T01:00:00Z");
  assert.deepEqual(
    { since: resolvePeriod({ period: "this_month" }, now).since, until: resolvePeriod({ period: "this_month" }, now).until },
    { since: "2026-02-01", until: "2026-02-28" },
  );
  const lastMonth = resolvePeriod({ period: "last_month" }, now);
  assert.equal(lastMonth.since, "2026-01-01");
  assert.equal(lastMonth.until, "2026-01-31");
  assert.equal(lastMonth.endDate, "31/01/2026");

  const january = resolvePeriod({ period: "last_month" }, new Date("2026-01-10T12:00:00Z"));
  assert.equal(january.since, "2025-12-01");
  assert.equal(january.until, "2025-12-31");

  const leap = resolvePeriod({ period: "last_month" }, new Date("2028-03-05T12:00:00Z"));
  assert.equal(leap.until, "2028-02-29");
});

test("período: personalizado exige datas válidas e em ordem", () => {
  const now = new Date("2026-10-16T12:00:00Z");
  const custom = resolvePeriod({ period: "custom", customStart: "2026-09-01", customEnd: "2026-09-30" }, now);
  assert.equal(custom.startDate, "01/09/2026");
  assert.equal(custom.endDate, "30/09/2026");
  assert.throws(() => resolvePeriod({ period: "custom", customStart: "2026-09-30", customEnd: "2026-09-01" }, now));
  assert.throws(() => resolvePeriod({ period: "custom" }, now));
  assert.throws(() => resolvePeriod({ period: "custom", customStart: "2026-02-30", customEnd: "2026-03-01" }, now));
});

test("período: fuso inválido é detectado", () => {
  assert.equal(isValidTimeZone("America/Sao_Paulo"), true);
  assert.equal(isValidTimeZone("Marte/Olympus"), false);
});

// ---------------------------------------------------------------- agenda

test("agenda: diário no horário local; se já passou, vai para amanhã", () => {
  const base = { frequency: "daily", sendTime: "08:00", weekday: null, monthDay: null, timezone: "America/Sao_Paulo" };
  // 10:00 UTC = 07:00 SP → hoje 08:00 SP = 11:00 UTC
  assert.equal(computeNextRunAt(base, new Date("2026-10-16T10:00:00Z")), "2026-10-16T11:00:00.000Z");
  assert.equal(computeNextRunAt({ ...base, sendTime: "08:00:00" }, new Date("2026-10-16T11:00:00Z")), "2026-10-17T11:00:00.000Z");
});

test("agenda: semanal e mensal (dia 31 vira o último dia do mês)", () => {
  // 16/10/2026 é sexta (5); próxima segunda (1) é 19/10
  const weekly = { frequency: "weekly", sendTime: "09:30", weekday: 1, monthDay: null, timezone: "America/Sao_Paulo" };
  assert.equal(computeNextRunAt(weekly, new Date("2026-10-16T12:00:00Z")), "2026-10-19T12:30:00.000Z");

  const monthly = { frequency: "monthly", sendTime: "08:00", weekday: null, monthDay: 31, timezone: "America/Sao_Paulo" };
  assert.equal(computeNextRunAt(monthly, new Date("2026-11-05T12:00:00Z")), "2026-11-30T11:00:00.000Z");
  assert.equal(computeNextRunAt(monthly, new Date("2027-02-01T12:00:00Z")), "2027-02-28T11:00:00.000Z");
});

// ---------------------------------------------------------------- validação

const CLIENT = "11111111-1111-4111-8111-111111111111";
const ACCOUNT = "22222222-2222-4222-8222-222222222222";

test("schema: cria relatório com partes e valores padrão", () => {
  const parsed = createReportSchema.parse({ client_id: CLIENT, name: " Diário ", parts: [{ body: "Oi {{client_name}}" }] });
  assert.equal(parsed.name, "Diário");
  assert.equal(parsed.status, "draft");
  assert.equal(parsed.frequency, "daily");
  assert.equal(parsed.timezone, "America/Sao_Paulo");
  assert.equal(parsed.parts[0].period, "yesterday");
  assert.equal(parsed.parts[0].send_without_data, false);
});

test("schema: recusa org_id, next_run_at e campos desconhecidos (mass assignment)", () => {
  const base = { client_id: CLIENT, name: "X", parts: [{ body: "a" }] };
  assert.equal(createReportSchema.safeParse({ ...base, org_id: CLIENT }).success, false);
  assert.equal(createReportSchema.safeParse({ ...base, next_run_at: "2026-01-01T00:00:00Z" }).success, false);
  assert.equal(createReportSchema.safeParse({ ...base, parts: [{ body: "a", report_id: CLIENT }] }).success, false);
  assert.equal(updateReportSchema.safeParse({ org_id: CLIENT }).success, false);
  assert.equal(updateReportSchema.safeParse({}).success, false);
});

test("schema: agenda e período personalizado consistentes", () => {
  const base = { client_id: CLIENT, name: "X", parts: [{ body: "a" }] };
  assert.equal(createReportSchema.safeParse({ ...base, frequency: "weekly" }).success, false);
  assert.equal(createReportSchema.safeParse({ ...base, frequency: "weekly", weekday: 1 }).success, true);
  assert.equal(createReportSchema.safeParse({ ...base, frequency: "monthly", month_day: 32 }).success, false);
  assert.equal(createReportSchema.safeParse({ ...base, send_time: "25:00" }).success, false);
  assert.equal(createReportSchema.safeParse({ ...base, timezone: "Marte/Olympus" }).success, false);
  assert.equal(createReportSchema.safeParse({ ...base, parts: [] }).success, false);
  assert.equal(createReportSchema.safeParse({ ...base, parts: [{ body: "a", period: "custom" }] }).success, false);
  assert.equal(
    createReportSchema.safeParse({ ...base, parts: [{ body: "a", period: "custom", custom_start: "2026-09-01", custom_end: "2026-09-30" }] }).success,
    true,
  );
  assert.equal(scheduleSchema.safeParse({ status: "active", frequency: "monthly", send_time: "08:00:00", weekday: null, month_day: null, timezone: "UTC" }).success, false);
});

test("schema: preview live exige cliente ou conta; entrega aceita só os 3 passos", () => {
  assert.equal(previewSchema.parse({ body: "x" }).mode, "preview");
  assert.equal(previewSchema.safeParse({ body: "x", mode: "live" }).success, false);
  assert.equal(previewSchema.safeParse({ body: "x", mode: "live", adAccountId: ACCOUNT }).success, true);
  assert.equal(deliverySchema.safeParse({ step: "sent" }).success, true);
  assert.equal(deliverySchema.safeParse({ step: "generated" }).success, false);
  assert.equal(deliverySchema.safeParse({ step: "sent", note: "x".repeat(2001) }).success, false);
});

// ---------------------------------------------------------------- núcleo de geração

test("templateNeeds: só chama a Meta quando o texto usa alcance, frequência, vídeo ou ranking", () => {
  assert.deepEqual(templateNeeds("{{meta_spend}} {{meta_ctr}}"), { accountInsights: false, creatives: false });
  assert.deepEqual(templateNeeds("{{ meta_reach }}"), { accountInsights: true, creatives: false });
  assert.deepEqual(templateNeeds("{{meta_video_p25.video_view}}"), { accountInsights: true, creatives: false });
  assert.deepEqual(templateNeeds("{{meta_top_3_creatives_ranking}}"), { accountInsights: false, creatives: true });
  assert.deepEqual(templateNeeds("{{meta_all_creatives_ranking}}"), { accountInsights: false, creatives: true });
});

test("redactSecrets remove token da Meta de mensagens de erro", () => {
  const msg = redactSecrets("GET https://graph.facebook.com/v21.0/act_1?access_token=EAABsecretsecretsecretsecret123&x=1 falhou EAAZZZZZZZZZZZZZZZZZZZZZZZZZ");
  assert.doesNotMatch(msg, /EAAB|EAAZ/);
  assert.match(msg, /access_token=\[redacted\]/);
  assert.equal(redactSecrets("x".repeat(2000)).length, 1000);
});

test("isUniqueViolation reconhece o código do Postgres", () => {
  assert.equal(isUniqueViolation({ code: "23505" }), true);
  assert.equal(isUniqueViolation({ code: "23503" }), false);
  assert.equal(isUniqueViolation(null), false);
});

const ACC_A = { id: "acc-a", externalId: "act_1", clientId: "client-1", platform: "meta", currency: "BRL" };
const ACC_B = { id: "acc-b", externalId: "act_2", clientId: "client-1", platform: "meta", currency: "BRL" };
const ACC_OTHER = { id: "acc-x", externalId: "act_9", clientId: "client-2", platform: "meta", currency: "BRL" };
const ACC_FREE = { id: "acc-f", externalId: "act_5", clientId: null, platform: "meta", currency: "USD" };

test("selectPartAccounts: conta da parte precisa estar vinculada ao cliente; sem conta usa todas do cliente", () => {
  const all = [ACC_A, ACC_B, ACC_OTHER, ACC_FREE];
  assert.deepEqual(selectPartAccounts(null, "client-1", all).map((a) => a.id), ["acc-a", "acc-b"]);
  assert.deepEqual(selectPartAccounts("acc-b", "client-1", all).map((a) => a.id), ["acc-b"]);
  assert.deepEqual(selectPartAccounts("acc-f", "client-1", all), []);
  assert.deepEqual(selectPartAccounts("acc-x", "client-1", all), []);
});

function fakeSource(overrides = {}) {
  const calls = { daily: [], insights: [], creatives: [] };
  const source = {
    calls,
    async loadDailyRows(accountIds, range) {
      calls.daily.push({ accountIds, range });
      return [{ spend: 100, impressions: 10000, clicks: 200, conversions: 4, revenue_attributed: 500 }];
    },
    async loadInsightMetrics(account, range) {
      calls.insights.push({ account: account.id, range });
      return { meta_reach: 4200, meta_frequency: 2.38 };
    },
    async loadTopCreatives(account) {
      calls.creatives.push(account.id);
      return [{ name: "Ad 1", results: 3, cpa: 10, ctr: 2 }];
    },
    ...overrides,
  };
  return source;
}

const NOW = new Date("2026-10-16T11:00:00Z");

test("renderLivePart: métricas do banco + Insights de uma conta, período e cliente preenchidos", async () => {
  const source = fakeSource();
  const r = await renderLivePart(
    {
      body: "{{client_name}} {{start_date}}: {{meta_spend}} | alcance {{meta_reach}}",
      period: { period: "yesterday" },
      accounts: [ACC_A],
      clientName: "Loja X",
      timezone: "America/Sao_Paulo",
      now: NOW,
      sendWithoutData: false,
    },
    source,
  );
  assert.equal(plain(r.text), "Loja X 15/10/2026: R$ 100,00 | alcance 4.200");
  assert.deepEqual(r.missing, []);
  assert.equal(r.skipped, false);
  assert.deepEqual(source.calls.daily[0].range, { since: "2026-10-15", until: "2026-10-15" });
  assert.deepEqual(source.calls.creatives, []);
});

test("renderLivePart: falha da Meta mantém as métricas do banco e registra o motivo sem vazar token", async () => {
  const source = fakeSource({
    async loadInsightMetrics() {
      throw new Error("Token expirou access_token=EAAsecretsecretsecretsecret");
    },
  });
  const r = await renderLivePart(
    { body: "{{meta_spend}} {{meta_reach}}", period: { period: "yesterday" }, accounts: [ACC_A], clientName: "X", timezone: "America/Sao_Paulo", now: NOW, sendWithoutData: false },
    source,
  );
  assert.equal(plain(r.text), "R$ 100,00 —");
  assert.deepEqual(r.missing, ["meta_reach"]);
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /Token expirou/);
  assert.doesNotMatch(r.warnings[0], /EAAsecret/);
});

test("renderLivePart: Insights só com uma conta; com várias, avisa e não inventa alcance", async () => {
  const source = fakeSource();
  const r = await renderLivePart(
    { body: "{{meta_reach}}", period: { period: "yesterday" }, accounts: [ACC_A, ACC_B], clientName: "X", timezone: "America/Sao_Paulo", now: NOW, sendWithoutData: false },
    source,
  );
  assert.equal(r.text, "—");
  assert.deepEqual(source.calls.insights, []);
  assert.deepEqual(source.calls.daily[0].accountIds, ["acc-a", "acc-b"]);
  assert.match(r.warnings[0], /2 contas/);
});

test("renderLivePart: sem dado pula a parte, a menos que send_without_data", async () => {
  const empty = fakeSource({ async loadDailyRows() { return []; } });
  const input = { body: "{{meta_spend}} {{meta_reach}}", period: { period: "yesterday" }, accounts: [ACC_A], clientName: "X", timezone: "America/Sao_Paulo", now: NOW, sendWithoutData: false };
  const skipped = await renderLivePart(input, empty);
  assert.equal(skipped.skipped, true);
  assert.deepEqual(empty.calls.insights, []);

  const forced = await renderLivePart({ ...input, sendWithoutData: true }, empty);
  assert.equal(forced.skipped, false);
  assert.equal(forced.text, "— 4.200");

  const noAccounts = await renderLivePart({ ...input, accounts: [] }, fakeSource());
  assert.equal(noAccounts.skipped, true);
});

function fakeStore({ insert = { inserted: true, runId: "run-1" }, report, accounts = [ACC_A, ACC_B], source = fakeSource() } = {}) {
  const finished = [];
  return {
    finished,
    ...source,
    async insertRun() {
      if (insert instanceof Error) throw insert;
      return insert;
    },
    async loadReport() {
      if (report instanceof Error) throw report;
      return report === undefined
        ? {
            id: "rep-1",
            clientId: "client-1",
            clientName: "Loja X",
            timezone: "America/Sao_Paulo",
            parts: [
              { position: 0, adAccountId: "acc-a", period: "yesterday", customStart: null, customEnd: null, body: "Parte A {{meta_spend}} {{meta_reach}}", sendWithoutData: false },
              { position: 1, adAccountId: null, period: "last_7d", customStart: null, customEnd: null, body: "Parte B {{meta_cpm}} {{meta_spned}}", sendWithoutData: false },
            ],
          }
        : report;
    },
    async loadAccounts() {
      return accounts;
    },
    async finishRun(runId, patch) {
      finished.push({ runId, ...patch });
    },
  };
}

test("runGeneration: duplicado no mesmo minuto devolve skipped sem tocar em mais nada", async () => {
  const store = fakeStore({ insert: { inserted: false } });
  const result = await runGeneration(store, { now: NOW });
  assert.deepEqual(result, { skipped: true });
  assert.deepEqual(store.finished, []);
});

test("runGeneration: junta as partes com linha em branco e une as variáveis faltantes", async () => {
  const store = fakeStore();
  const result = await runGeneration(store, { now: NOW });
  assert.equal(result.skipped, false);
  assert.equal(result.status, "generated");
  assert.equal(plain(result.renderedBody), "Parte A R$ 100,00 4.200\n\nParte B R$ 10,00 —");
  assert.deepEqual(result.missing, ["meta_spned"]);
  assert.equal(store.finished.length, 1);
  assert.equal(store.finished[0].status, "generated");
  assert.equal(store.finished[0].runId, "run-1");
  assert.equal(store.finished[0].errorMessage, null);
});

test("runGeneration: aviso do Insights fica registrado no run gerado", async () => {
  const source = fakeSource({ async loadInsightMetrics() { throw new Error("A Meta não respondeu em 15s."); } });
  const store = fakeStore({ source });
  const result = await runGeneration(store, { now: NOW });
  assert.equal(result.status, "generated");
  assert.match(store.finished[0].errorMessage, /não respondeu/);
  assert.deepEqual(result.missing, ["meta_reach", "meta_spned"]);
});

test("runGeneration: todas as partes sem dado → run skipped", async () => {
  const source = fakeSource({ async loadDailyRows() { return []; } });
  const store = fakeStore({ source });
  const result = await runGeneration(store, { now: NOW });
  assert.equal(result.status, "skipped");
  assert.equal(store.finished[0].renderedBody, null);
  assert.match(store.finished[0].errorMessage, /Sem dados/);
});

test("runGeneration: erro inesperado marca failed; relatório sumido também", async () => {
  const boom = fakeStore({ source: fakeSource({ async loadDailyRows() { throw new Error("db caiu"); } }) });
  const result = await runGeneration(boom, { now: NOW });
  assert.equal(result.status, "failed");
  assert.equal(boom.finished[0].status, "failed");
  assert.match(boom.finished[0].errorMessage, /db caiu/);

  const gone = fakeStore({ report: null });
  assert.equal((await runGeneration(gone, { now: NOW })).status, "failed");

  await assert.rejects(runGeneration(fakeStore({ insert: new Error("insert falhou") }), { now: NOW }), /insert falhou/);
});

// ---------------------------------------------------------------- disparo agendado (cron)

const {
  DISPATCH_BATCH_SIZE,
  STUCK_RUN_MESSAGE,
  isReportDue,
  selectDueReports,
  nextRunAfter,
  hasTimeForAnother,
  stuckRunCutoff,
  isStuckRun,
  outcomeOf,
  runDispatch,
} = await import("../src/lib/reports/dispatch.ts");

const DISPATCH_NOW = new Date("2026-10-16T12:00:00Z");

function dueRow(overrides = {}) {
  return {
    id: "rep-1",
    org_id: "org-1",
    status: "active",
    frequency: "daily",
    send_time: "08:00",
    weekday: null,
    month_day: null,
    timezone: "America/Sao_Paulo",
    next_run_at: "2026-10-16T11:00:00.000Z",
    ...overrides,
  };
}

test("disparo: só relatório ativo com next_run_at vencido entra", () => {
  assert.equal(isReportDue(dueRow(), DISPATCH_NOW), true);
  assert.equal(isReportDue(dueRow({ next_run_at: "2026-10-16T12:00:00.000Z" }), DISPATCH_NOW), true);
  assert.equal(isReportDue(dueRow({ next_run_at: "2026-10-16T12:00:01.000Z" }), DISPATCH_NOW), false);
  assert.equal(isReportDue(dueRow({ status: "paused" }), DISPATCH_NOW), false);
  assert.equal(isReportDue(dueRow({ status: "draft" }), DISPATCH_NOW), false);
  assert.equal(isReportDue(dueRow({ next_run_at: null }), DISPATCH_NOW), false);
  assert.equal(isReportDue(dueRow({ next_run_at: "lixo" }), DISPATCH_NOW), false);
});

test("disparo: seleção pega os mais atrasados primeiro e respeita o limite", () => {
  const rows = [
    dueRow({ id: "b", next_run_at: "2026-10-16T10:00:00.000Z" }),
    dueRow({ id: "futuro", next_run_at: "2026-10-17T11:00:00.000Z" }),
    dueRow({ id: "a", next_run_at: "2026-10-15T11:00:00.000Z" }),
    dueRow({ id: "c", next_run_at: "2026-10-16T11:30:00.000Z" }),
    dueRow({ id: "pausado", status: "paused", next_run_at: "2026-10-01T11:00:00.000Z" }),
  ];
  assert.deepEqual(selectDueReports(rows, DISPATCH_NOW).map((r) => r.id), ["a", "b", "c"]);
  assert.deepEqual(selectDueReports(rows, DISPATCH_NOW, 2).map((r) => r.id), ["a", "b"]);
  assert.equal(DISPATCH_BATCH_SIZE, 25);
  assert.equal(rows[0].id, "b");
});

test("disparo: próxima vaga vem depois de agora, sem recuperar vagas perdidas", () => {
  assert.equal(nextRunAfter(dueRow(), DISPATCH_NOW), "2026-10-17T11:00:00.000Z");
  const weekAgo = dueRow({ next_run_at: "2026-10-09T11:00:00.000Z" });
  assert.equal(nextRunAfter(weekAgo, DISPATCH_NOW), "2026-10-17T11:00:00.000Z");
  const weekly = dueRow({ frequency: "weekly", weekday: 1, next_run_at: "2026-09-07T11:00:00.000Z" });
  assert.equal(nextRunAfter(weekly, DISPATCH_NOW), "2026-10-19T11:00:00.000Z");
  const monthly = dueRow({ frequency: "monthly", month_day: 31, send_time: "09:30", next_run_at: "2026-09-30T12:30:00.000Z" });
  assert.equal(nextRunAfter(monthly, DISPATCH_NOW), "2026-10-31T12:30:00.000Z");
});

test("disparo: próxima vaga nunca repete a vaga que acabou de rodar", () => {
  const atSlot = new Date("2026-10-16T11:00:00Z");
  assert.equal(nextRunAfter(dueRow(), atSlot), "2026-10-17T11:00:00.000Z");
});

test("disparo: agenda impossível de calcular devolve null", () => {
  assert.equal(nextRunAfter(dueRow({ timezone: "Fuso/Inexistente" }), DISPATCH_NOW), null);
  assert.equal(nextRunAfter(dueRow({ frequency: "weekly", weekday: null }), DISPATCH_NOW), null);
});

test("disparo: orçamento de tempo para antes de ~50s", () => {
  const start = 1_000_000;
  assert.equal(hasTimeForAnother(start, start), true);
  assert.equal(hasTimeForAnother(start, start + 39_999), true);
  assert.equal(hasTimeForAnother(start, start + 40_001), false);
  assert.equal(hasTimeForAnother(start, start + 55_000), false);
});

test("disparo: run em queued há mais de 10 minutos está travado", () => {
  assert.equal(stuckRunCutoff(DISPATCH_NOW), "2026-10-16T11:50:00.000Z");
  assert.equal(isStuckRun({ status: "queued", created_at: "2026-10-16T11:49:00.000Z" }, DISPATCH_NOW), true);
  assert.equal(isStuckRun({ status: "queued", created_at: "2026-10-16T11:55:00.000Z" }, DISPATCH_NOW), false);
  assert.equal(isStuckRun({ status: "generated", created_at: "2026-10-16T10:00:00.000Z" }, DISPATCH_NOW), false);
  assert.equal(STUCK_RUN_MESSAGE, "Geração interrompida (tempo esgotado)");
});

test("disparo: resultado da geração vira contagem", () => {
  assert.equal(outcomeOf({ skipped: true }), "skipped");
  const base = { skipped: false, runId: "r", renderedBody: null, missing: [], warnings: [] };
  assert.equal(outcomeOf({ ...base, status: "generated" }), "generated");
  assert.equal(outcomeOf({ ...base, status: "skipped" }), "skipped");
  assert.equal(outcomeOf({ ...base, status: "failed" }), "failed");
});

function fakeDispatchDb({ reports, runs = [], generate, clock, failRecover = false }) {
  const state = {
    reports: reports.map((r) => ({ ...r })),
    runs: runs.map((r) => ({ ...r })),
    advances: 0,
    generateCalls: 0,
  };
  const tick = () => new Promise((resolve) => setImmediate(resolve));
  const deps = {
    now: clock ?? (() => DISPATCH_NOW),
    async recoverStuckRuns(cutoffIso) {
      await tick();
      if (failRecover) throw new Error("db fora");
      const stuck = state.runs.filter((r) => r.status === "queued" && r.created_at < cutoffIso);
      for (const r of stuck) Object.assign(r, { status: "failed", error_message: STUCK_RUN_MESSAGE });
      return stuck.length;
    },
    async loadDueReports(nowIso, limit) {
      await tick();
      const due = state.reports
        .filter((r) => r.status === "active" && r.next_run_at && r.next_run_at <= nowIso)
        .sort((a, b) => a.next_run_at.localeCompare(b.next_run_at));
      return { rows: due.slice(0, limit).map((r) => ({ ...r })), total: due.length };
    },
    async generate(row) {
      state.generateCalls++;
      await tick();
      const key = `${row.id}|${row.next_run_at}`;
      if (state.runs.some((r) => r.key === key)) return { skipped: true };
      state.runs.push({ key, status: "queued", created_at: DISPATCH_NOW.toISOString() });
      await tick();
      const result = generate ? await generate(row) : "generated";
      if (result instanceof Error) throw result;
      state.runs.find((r) => r.key === key).status = result;
      return { skipped: false, runId: key, status: result, renderedBody: null, missing: [], warnings: [] };
    },
    async advance(row, nextRunAt) {
      await tick();
      const current = state.reports.find((r) => r.id === row.id);
      if (!current || current.status !== "active" || current.next_run_at !== row.next_run_at) return false;
      state.advances++;
      if (nextRunAt === null) Object.assign(current, { status: "paused", next_run_at: null });
      else current.next_run_at = nextRunAt;
      return true;
    },
    log() {},
  };
  return { state, deps };
}

test("runDispatch: gera, avança e conta por relatório", async () => {
  const { state, deps } = fakeDispatchDb({
    reports: [
      dueRow({ id: "ok" }),
      dueRow({ id: "vazio", next_run_at: "2026-10-16T10:00:00.000Z" }),
      dueRow({ id: "falha", next_run_at: "2026-10-16T09:00:00.000Z" }),
      dueRow({ id: "futuro", next_run_at: "2026-10-16T13:00:00.000Z" }),
    ],
    generate: async (row) => ({ ok: "generated", vazio: "skipped", falha: "failed" })[row.id],
  });
  const summary = await runDispatch(deps);
  assert.deepEqual(summary, { due: 3, generated: 1, skipped: 1, failed: 1, recovered: 0, remaining: 0 });
  assert.equal(state.reports.find((r) => r.id === "ok").next_run_at, "2026-10-17T11:00:00.000Z");
  assert.equal(state.reports.find((r) => r.id === "falha").next_run_at, "2026-10-17T11:00:00.000Z");
  assert.equal(state.reports.find((r) => r.id === "futuro").next_run_at, "2026-10-16T13:00:00.000Z");
});

test("runDispatch: erro na geração conta como failed e ainda avança o relatório", async () => {
  const { state, deps } = fakeDispatchDb({
    reports: [dueRow()],
    generate: async () => new Error("Meta fora do ar"),
  });
  const summary = await runDispatch(deps);
  assert.equal(summary.failed, 1);
  assert.equal(state.reports[0].next_run_at, "2026-10-17T11:00:00.000Z");
});

test("runDispatch: vaga já gerada (duplicada) conta como skipped e avança", async () => {
  const { state, deps } = fakeDispatchDb({
    reports: [dueRow()],
    runs: [{ key: "rep-1|2026-10-16T11:00:00.000Z", status: "generated", created_at: "2026-10-16T11:00:00.000Z" }],
  });
  const summary = await runDispatch(deps);
  assert.equal(summary.skipped, 1);
  assert.equal(summary.generated, 0);
  assert.equal(state.runs.length, 1);
  assert.equal(state.reports[0].next_run_at, "2026-10-17T11:00:00.000Z");
});

test("runDispatch: agenda impossível pausa o relatório para não travar a fila", async () => {
  const { state, deps } = fakeDispatchDb({ reports: [dueRow({ timezone: "Fuso/Inexistente" })] });
  await runDispatch(deps);
  assert.equal(state.reports[0].status, "paused");
  assert.equal(state.reports[0].next_run_at, null);
});

test("runDispatch: atrasado há dias gera uma vez só e pula para a próxima vaga", async () => {
  const { state, deps } = fakeDispatchDb({ reports: [dueRow({ next_run_at: "2026-10-10T11:00:00.000Z" })] });
  const summary = await runDispatch(deps);
  assert.equal(summary.generated, 1);
  assert.equal(state.runs.length, 1);
  assert.equal(state.reports[0].next_run_at, "2026-10-17T11:00:00.000Z");
  assert.deepEqual(await runDispatch(deps), { due: 0, generated: 0, skipped: 0, failed: 0, recovered: 0, remaining: 0 });
});

test("runDispatch: duas chamadas simultâneas geram um único run e avançam uma vez", async () => {
  const { state, deps } = fakeDispatchDb({ reports: [dueRow()] });
  const [a, b] = await Promise.all([runDispatch(deps), runDispatch(deps)]);
  assert.equal(state.runs.length, 1);
  assert.equal(state.advances, 1);
  assert.equal(a.generated + b.generated, 1);
  assert.equal(a.skipped + b.skipped, 1);
  assert.equal(state.reports[0].next_run_at, "2026-10-17T11:00:00.000Z");
});

test("runDispatch: para no orçamento de tempo e deixa o resto para o próximo tick", async () => {
  let elapsed = 0;
  const reports = Array.from({ length: 6 }, (_, i) => dueRow({ id: `r${i}`, next_run_at: `2026-10-16T0${i}:00:00.000Z` }));
  const { state, deps } = fakeDispatchDb({
    reports,
    clock: () => new Date(DISPATCH_NOW.getTime() + elapsed),
    generate: async () => {
      elapsed += 15_000;
      return "generated";
    },
  });
  const summary = await runDispatch(deps);
  assert.equal(summary.due, 6);
  assert.equal(summary.generated, 3);
  assert.equal(summary.remaining, 3);
  assert.equal(state.generateCalls, 3);
  assert.deepEqual(
    state.reports.filter((r) => r.next_run_at <= DISPATCH_NOW.toISOString()).map((r) => r.id),
    ["r3", "r4", "r5"],
  );
});

test("runDispatch: limite por chamada e remaining contam o total vencido", async () => {
  const reports = Array.from({ length: 30 }, (_, i) =>
    dueRow({ id: `r${i}`, next_run_at: new Date(Date.UTC(2026, 9, 15, 0, i)).toISOString() }),
  );
  const { state, deps } = fakeDispatchDb({ reports });
  const summary = await runDispatch(deps);
  assert.equal(summary.due, 30);
  assert.equal(summary.generated, 25);
  assert.equal(summary.remaining, 5);
  assert.equal(state.generateCalls, 25);
});

test("runDispatch: recupera runs travados e segue mesmo se a recuperação falhar", async () => {
  const stale = { key: "velho", status: "queued", created_at: "2026-10-16T11:00:00.000Z" };
  const fresh = { key: "novo", status: "queued", created_at: "2026-10-16T11:58:00.000Z" };
  const { state, deps } = fakeDispatchDb({ reports: [], runs: [stale, fresh] });
  const summary = await runDispatch(deps);
  assert.equal(summary.recovered, 1);
  assert.equal(state.runs.find((r) => r.key === "velho").status, "failed");
  assert.equal(state.runs.find((r) => r.key === "velho").error_message, STUCK_RUN_MESSAGE);
  assert.equal(state.runs.find((r) => r.key === "novo").status, "queued");

  const broken = fakeDispatchDb({ reports: [dueRow()], failRecover: true });
  const after = await runDispatch(broken.deps);
  assert.equal(after.recovered, 0);
  assert.equal(after.generated, 1);
});

// ---------------------------------------------------------------- Google e totais na parte

const ACC_META_NAMED = { ...ACC_A, name: "BM Loja" };
const ACC_GOOGLE = { id: "acc-g", externalId: "1973021190", clientId: "client-1", platform: "google", currency: "BRL", name: "Loja Google" };

function googleSource(overrides = {}) {
  const calls = { google: [] };
  return {
    ...fakeSource(),
    calls: { ...fakeSource().calls, ...calls },
    async loadGoogleRows(accountIds, range) {
      calls.google.push({ accountIds, range });
      return [{ cost_micros: 100000000, impressions: 5000, clicks: 300, conversions: 10, conversions_value: 300 }];
    },
    googleCalls: calls.google,
    ...overrides,
  };
}

test("renderLivePart: Meta e Google na mesma parte, com totais e nomes das contas", async () => {
  const daily = [];
  const source = googleSource({
    async loadDailyRows(accountIds) {
      daily.push(accountIds);
      return [{ spend: 100, impressions: 10000, clicks: 200, conversions: 4, revenue_attributed: 500 }];
    },
  });
  const r = await renderLivePart(
    {
      body: "{{meta_spend}} + {{google_spend}} = {{spend}} | {{account_name}} | {{google_account_name}} | {{currency}}",
      period: { period: "yesterday" },
      accounts: [ACC_META_NAMED, ACC_GOOGLE],
      clientName: "Loja X",
      timezone: "America/Sao_Paulo",
      now: NOW,
      sendWithoutData: false,
    },
    source,
  );
  assert.equal(plain(r.text), "R$ 100,00 + R$ 100,00 = R$ 200,00 | BM Loja, Loja Google | Loja Google | BRL");
  assert.deepEqual(r.missing, []);
  assert.deepEqual(daily, [["acc-a"]]);
  assert.deepEqual(source.googleCalls.map((c) => c.accountIds), [["acc-g"]]);
});

test("renderLivePart: parte só com Google e sem dado no período é pulada", async () => {
  const source = googleSource({ async loadGoogleRows() { return []; } });
  const r = await renderLivePart(
    {
      body: "{{google_spend}}",
      period: { period: "yesterday" },
      accounts: [ACC_GOOGLE],
      clientName: null,
      timezone: "America/Sao_Paulo",
      now: NOW,
      sendWithoutData: false,
    },
    source,
  );
  assert.equal(r.skipped, true);
});

test("templateNeeds: alcance total pede Insights; ranking simples pede criativos", () => {
  assert.equal(templateNeeds("{{reach}}").accountInsights, true);
  assert.equal(templateNeeds("{{meta_all_creatives_simple}}").creatives, true);
});

test("renderLivePart: tipo e valor do resultado principal da Meta", async () => {
  const source = fakeSource({
    async loadDailyRows() {
      return [{ spend: 50, impressions: 1000, clicks: 20, conversions: 9, revenue_attributed: 0, actions: { lead: 9 } }];
    },
  });
  const r = await renderLivePart(
    {
      body: "{{meta_result_value}} {{meta_result_type}} ({{meta_conv}})",
      period: { period: "yesterday" },
      accounts: [ACC_A],
      clientName: null,
      timezone: "America/Sao_Paulo",
      now: NOW,
      sendWithoutData: false,
    },
    source,
  );
  assert.equal(r.text, "9 Cadastros (9)");
});
