// Rodar de apps/dashboard: node --test scripts/activity-db.test.mjs
// Testa a migration da Central de Histórico num Postgres em memória (PGlite). Nunca toca no banco real.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";

const MIGRATIONS = ["20261022000000_activity_events.sql", "20261022000100_activity_sync.sql", "20261022000300_google_ads.sql", "20261022000500_google_ads_extra_metrics.sql", "20261022000600_client_taxonomy.sql", "20261022000700_automation_rules.sql"].map((file) =>
  readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"),
);

// Mínimo do Supabase que a migration usa.
const STUBS = `
  CREATE SCHEMA IF NOT EXISTS extensions;
  CREATE SCHEMA IF NOT EXISTS auth;
  CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
  GRANT USAGE ON SCHEMA public, auth, extensions TO anon, authenticated, service_role;
  CREATE TABLE auth.users (id uuid PRIMARY KEY);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
  CREATE TABLE public.organizations (id uuid PRIMARY KEY);
  CREATE TABLE public.profiles (id uuid PRIMARY KEY, org_id uuid REFERENCES public.organizations(id));
  CREATE FUNCTION public.auth_org_id() RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$ SELECT org_id FROM public.profiles WHERE id = auth.uid() $$;
  GRANT EXECUTE ON FUNCTION public.auth_org_id() TO anon, authenticated, service_role;
  CREATE TABLE public.clients (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name text NOT NULL, archived_at timestamptz
  );
  CREATE TABLE public.ad_accounts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
    platform text NOT NULL DEFAULT 'meta', external_id text NOT NULL, name text,
    status text NOT NULL DEFAULT 'active', timezone text,
    CONSTRAINT ad_accounts_org_id_external_id_key UNIQUE (org_id, external_id)
  );
`;

const ORG_A = "00000000-0000-0000-0000-00000000000a";
const ORG_B = "00000000-0000-0000-0000-00000000000b";
const USER_A = "00000000-0000-0000-0000-0000000000a1";
const USER_A2 = "00000000-0000-0000-0000-0000000000a2";
const CLIENT_A1 = "00000000-0000-0000-0000-00000000c0a1";
const CLIENT_A2 = "00000000-0000-0000-0000-00000000c0a2";
const CLIENT_B1 = "00000000-0000-0000-0000-00000000c0b1";
const ACC_A = "00000000-0000-0000-0000-0000000acc0a";
const ACC_ORPHAN = "00000000-0000-0000-0000-0000000acc0f";
const ACC_B = "00000000-0000-0000-0000-0000000acc0b";

let db;

before(async () => {
  db = await PGlite.create({ extensions: { btree_gist } });
  await db.exec(STUBS);
  await db.exec(`
    INSERT INTO public.organizations VALUES ('${ORG_A}'), ('${ORG_B}');
    INSERT INTO auth.users VALUES ('${USER_A}'), ('${USER_A2}');
    INSERT INTO public.profiles VALUES ('${USER_A}', '${ORG_A}'), ('${USER_A2}', '${ORG_A}');
    INSERT INTO public.clients (id, org_id, name) VALUES ('${CLIENT_A1}', '${ORG_A}', 'Cliente A1'), ('${CLIENT_A2}', '${ORG_A}', 'Cliente A2'), ('${CLIENT_B1}', '${ORG_B}', 'Cliente B1');
    INSERT INTO public.ad_accounts (id, org_id, client_id, external_id, name) VALUES
      ('${ACC_A}', '${ORG_A}', '${CLIENT_A1}', 'act_1', 'Conta A'),
      ('${ACC_ORPHAN}', '${ORG_A}', NULL, 'act_2', 'Conta sem cliente'),
      ('${ACC_B}', '${ORG_B}', '${CLIENT_B1}', 'act_3', 'Conta B');
  `);
  for (const sql of MIGRATIONS) await db.exec(sql);
});

const metaRow = (over = {}) => ({
  dedupe_key: `meta:v1:act_1:${Math.random()}`,
  source: "meta",
  event_type: "update_ad_set_budget",
  action: "ad_set.budget_changed",
  category: "budget",
  counts_as_work: true,
  classifier_version: 1,
  object_level: "ad_set",
  object_external_id: "120000000000000001",
  object_name: "Conjunto X",
  account_external_id: "act_1",
  ad_account_id: ACC_A,
  title: "Orçamento diário alterado",
  occurred_at: new Date().toISOString(),
  actor_kind: "person",
  actor_name: "Pessoa A",
  before: { amountMinor: 5000, currency: "BRL", period: "daily" },
  after: { amountMinor: 8000, currency: "BRL", period: "daily" },
  raw: { event_type: "update_ad_set_budget" },
  ...over,
});

async function insert(org, rows) {
  const r = await db.query("SELECT * FROM public.insert_activity_events($1, $2::jsonb)", [org, JSON.stringify(rows)]);
  return r.rows[0];
}
const eventByKey = async (key) => (await db.query("SELECT * FROM public.activity_events WHERE dedupe_key = $1", [key])).rows[0];
const rejects = async (sql, params, pattern) => assert.rejects(() => db.query(sql, params), pattern);

// ── Inserção e dedupe ───────────────────────────────────────────────────────
test("insere em lote e conta duplicados como ignorados", async () => {
  const row = metaRow({ dedupe_key: "k-dup" });
  assert.deepEqual(await insert(ORG_A, [row, metaRow()]), { inserted: 2, skipped: 0 });
  assert.deepEqual(await insert(ORG_A, [row]), { inserted: 0, skipped: 1 });
});

test("a mesma chave em orgs diferentes não colide", async () => {
  const r = await insert(ORG_B, [metaRow({ dedupe_key: "k-dup", ad_account_id: ACC_B, account_external_id: "act_3" })]);
  assert.equal(r.inserted, 1);
});

test("payload bruto vai para a tabela separada", async () => {
  await insert(ORG_A, [metaRow({ dedupe_key: "k-raw" })]);
  const ev = await eventByKey("k-raw");
  const raw = await db.query("SELECT raw FROM public.activity_event_raw WHERE event_id = $1", [ev.id]);
  assert.deepEqual(raw.rows[0].raw, { event_type: "update_ad_set_budget" });
});

test("conta de outra org é recusada", async () => {
  await assert.rejects(() => insert(ORG_A, [metaRow({ ad_account_id: ACC_B })]), /ACCOUNT_NOT_IN_ORG|violates foreign key/);
});

test("org nula é recusada", async () => {
  await assert.rejects(() => insert(null, [metaRow()]), /ORG_REQUIRED/);
});

// ── Atribuição ao cliente ───────────────────────────────────────────────────
test("evento de conta vinculada recebe o cliente; vínculo do backfill é presumido", async () => {
  await insert(ORG_A, [metaRow({ dedupe_key: "k-attr-1" })]);
  const ev = await eventByKey("k-attr-1");
  assert.equal(ev.client_id, CLIENT_A1);
  assert.equal(ev.attribution, "assumed");
});

test("conta sem cliente gera evento sem cliente, e ligar a conta carimba os órfãos", async () => {
  await insert(ORG_A, [metaRow({ dedupe_key: "k-orphan", ad_account_id: ACC_ORPHAN, account_external_id: "act_2" })]);
  const before = await eventByKey("k-orphan");
  assert.equal(before.client_id, null);
  assert.equal(before.attribution, "none");
  await db.query("UPDATE public.ad_accounts SET client_id = $1 WHERE id = $2", [CLIENT_A2, ACC_ORPHAN]);
  const after = await eventByKey("k-orphan");
  assert.equal(after.client_id, CLIENT_A2);
  assert.equal(after.attribution, "assumed");
  const rev = await db.query("SELECT column_name, rpc FROM public.activity_event_revisions WHERE event_id = $1", [after.id]);
  assert.ok(rev.rows.some((r) => r.column_name === "client_id" && r.rpc === "assignment"));
});

test("depois do vínculo, evento novo é by_assignment; reatribuir a conta não move o passado", async () => {
  await insert(ORG_A, [metaRow({ dedupe_key: "k-after-link", ad_account_id: ACC_ORPHAN, account_external_id: "act_2" })]);
  assert.equal((await eventByKey("k-after-link")).attribution, "by_assignment");
  await db.query("UPDATE public.ad_accounts SET client_id = $1 WHERE id = $2", [CLIENT_A1, ACC_ORPHAN]);
  assert.equal((await eventByKey("k-after-link")).client_id, CLIENT_A2);
  await insert(ORG_A, [metaRow({ dedupe_key: "k-after-move", ad_account_id: ACC_ORPHAN, account_external_id: "act_2" })]);
  assert.equal((await eventByKey("k-after-move")).client_id, CLIENT_A1);
});

test("vínculos de uma conta nunca se sobrepõem", async () => {
  const open = await db.query("SELECT count(*)::int AS n FROM public.ad_account_client_assignments WHERE ad_account_id = $1 AND valid_to IS NULL", [ACC_ORPHAN]);
  assert.equal(open.rows[0].n, 1);
  await rejects(
    "INSERT INTO public.ad_account_client_assignments (org_id, ad_account_id, client_id, valid_from) VALUES ($1, $2, $3, now() - interval '1 hour')",
    [ORG_A, ACC_ORPHAN, CLIENT_A2],
    /conflicting key value violates exclusion constraint|duplicate key/,
  );
});

// ── Imutabilidade ───────────────────────────────────────────────────────────
test("conteúdo do evento não pode ser alterado, nem pelo dono do banco", async () => {
  const ev = await eventByKey("k-dup");
  await rejects("UPDATE public.activity_events SET title = 'outro' WHERE id = $1", [ev.id], /ACTIVITY_EVENT_IMMUTABLE/);
  await rejects("UPDATE public.activity_events SET client_id = $2 WHERE id = $1", [ev.id, CLIENT_A2], /ACTIVITY_EVENT_IMMUTABLE/);
});

test("evento não pode ser apagado nem truncado", async () => {
  const ev = await eventByKey("k-dup");
  await rejects("DELETE FROM public.activity_events WHERE id = $1", [ev.id], /ACTIVITY_EVENT_IMMUTABLE/);
  await rejects("TRUNCATE public.activity_events CASCADE", [], /ACTIVITY_EVENT_IMMUTABLE/);
});

test("nome da campanha só pode ir de vazio para preenchido, uma vez", async () => {
  const ev = await eventByKey("k-raw");
  await db.query("UPDATE public.activity_events SET campaign_name = 'Campanha X' WHERE id = $1", [ev.id]);
  await rejects("UPDATE public.activity_events SET campaign_name = 'Outra' WHERE id = $1", [ev.id], /ACTIVITY_EVENT_IMMUTABLE/);
});

test("excluir a conta mantém o evento, só solta o vínculo com a conta", async () => {
  await db.exec(`INSERT INTO public.ad_accounts (id, org_id, client_id, external_id) VALUES ('00000000-0000-0000-0000-0000000acc0d', '${ORG_A}', '${CLIENT_A1}', 'act_9')`);
  await insert(ORG_A, [metaRow({ dedupe_key: "k-gone", ad_account_id: "00000000-0000-0000-0000-0000000acc0d", account_external_id: "act_9" })]);
  await db.query("DELETE FROM public.ad_accounts WHERE id = '00000000-0000-0000-0000-0000000acc0d'");
  const ev = await eventByKey("k-gone");
  assert.equal(ev.ad_account_id, null);
  assert.equal(ev.account_external_id, "act_9");
  assert.equal(ev.client_id, CLIENT_A1);
});

// ── Anular e reatribuir ─────────────────────────────────────────────────────
test("anular exige motivo, não apaga e registra revisão", async () => {
  const ev = await eventByKey("k-dup");
  await rejects("SELECT public.void_activity_events($1, $2, $3, $4)", [ORG_A, [ev.id], USER_A, "x"], /REASON_REQUIRED/);
  const r = await db.query("SELECT public.void_activity_events($1, $2, $3, $4) AS n", [ORG_A, [ev.id], USER_A, "Evento de teste"]);
  assert.equal(r.rows[0].n, 1);
  const after = await eventByKey("k-dup");
  assert.ok(after.voided_at);
  assert.equal(after.void_reason, "Evento de teste");
  const rev = await db.query("SELECT reason, changed_by FROM public.activity_event_revisions WHERE event_id = $1 AND column_name = 'voided_at'", [ev.id]);
  assert.equal(rev.rows[0].reason, "Evento de teste");
  assert.equal(rev.rows[0].changed_by, USER_A);
});

test("anular ou reatribuir com um id de outra org aborta tudo", async () => {
  const mine = await eventByKey("k-attr-1");
  const theirs = (await db.query("SELECT id FROM public.activity_events WHERE org_id = $1 LIMIT 1", [ORG_B])).rows[0];
  await rejects("SELECT public.void_activity_events($1, $2, $3, $4)", [ORG_A, [mine.id, theirs.id], USER_A, "Motivo válido"], /EVENT_NOT_IN_ORG/);
  await rejects("SELECT public.reassign_activity_events($1, $2, $3, $4, $5)", [ORG_A, [mine.id, theirs.id], CLIENT_A2, USER_A, "Motivo válido"], /EVENT_NOT_IN_ORG/);
  assert.equal((await eventByKey("k-attr-1")).voided_at, null);
});

test("reatribuir move para cliente da mesma org e marca manual_override", async () => {
  const ev = await eventByKey("k-attr-1");
  await rejects("SELECT public.reassign_activity_events($1, $2, $3, $4, $5)", [ORG_A, [ev.id], CLIENT_B1, USER_A, "Cliente errado"], /CLIENT_NOT_IN_ORG/);
  await db.query("SELECT public.reassign_activity_events($1, $2, $3, $4, $5)", [ORG_A, [ev.id], CLIENT_A2, USER_A, "Cliente errado"]);
  const after = await eventByKey("k-attr-1");
  assert.equal(after.client_id, CLIENT_A2);
  assert.equal(after.attribution, "manual_override");
});

test("reclassificar altera só a classificação e registra a versão", async () => {
  const ev = await eventByKey("k-raw");
  await db.query("SELECT public.reclassify_activity_events($1, $2::jsonb, $3)", [ORG_A, JSON.stringify([{ id: ev.id, category: "bidding", counts_as_work: false }]), 2]);
  const after = await eventByKey("k-raw");
  assert.equal(after.category, "bidding");
  assert.equal(after.counts_as_work, false);
  assert.equal(after.classifier_version, 2);
});

// ── Registro manual ─────────────────────────────────────────────────────────
test("registro manual exige cliente da org e autor", async () => {
  const manual = { dedupe_key: "manual:1", source: "manual", event_type: "manual", action: "meeting", category: "meeting", counts_as_work: true, object_level: "client", title: "Reunião", occurred_at: new Date().toISOString(), actor_kind: "person", client_id: CLIENT_A1, created_by: USER_A, visibility: "client" };
  assert.equal((await insert(ORG_A, [manual])).inserted, 1);
  await assert.rejects(() => insert(ORG_A, [{ ...manual, dedupe_key: "manual:2", client_id: CLIENT_B1 }]), /CLIENT_NOT_IN_ORG/);
  await assert.rejects(() => insert(ORG_A, [{ ...manual, dedupe_key: "manual:3", created_by: null }]), /manual_requires_author|violates check/);
});

test("autor edita o registro manual por 15 min; depois não", async () => {
  const ev = await eventByKey("manual:1");
  await db.query("SELECT public.update_manual_activity($1, $2, $3, $4::jsonb)", [ORG_A, ev.id, USER_A, JSON.stringify({ title: "Reunião de alinhamento" })]);
  assert.equal((await eventByKey("manual:1")).title, "Reunião de alinhamento");
  await rejects("SELECT public.update_manual_activity($1, $2, $3, $4::jsonb)", [ORG_A, ev.id, USER_A2, JSON.stringify({ title: "x" })], /NOT_AUTHOR/);
  await db.query(`INSERT INTO public.activity_events (org_id, client_id, attribution, source, event_type, action, category, object_level, title, occurred_at, recorded_at, actor_kind, dedupe_key, created_by)
    VALUES ($1, $2, 'manual_override', 'manual', 'manual', 'note', 'note', 'client', 'Antiga', now() - interval '1 day', now() - interval '20 minutes', 'person', 'manual:old', $3)`, [ORG_A, CLIENT_A1, USER_A]);
  const old = await eventByKey("manual:old");
  await rejects("SELECT public.update_manual_activity($1, $2, $3, $4::jsonb)", [ORG_A, old.id, USER_A, JSON.stringify({ title: "x" })], /EDIT_WINDOW_CLOSED/);
});

// ── Payload bruto e retenção ────────────────────────────────────────────────
test("payload bruto não pode ser alterado nem apagado fora da retenção", async () => {
  const ev = await eventByKey("k-raw");
  await rejects("UPDATE public.activity_event_raw SET raw = '{}' WHERE event_id = $1", [ev.id], /ACTIVITY_RAW_IMMUTABLE/);
  await rejects("DELETE FROM public.activity_event_raw WHERE event_id = $1", [ev.id], /ACTIVITY_RAW_IMMUTABLE/);
});

test("retenção apaga só payloads com mais de 180 dias", async () => {
  const ev = await eventByKey("k-raw");
  const r = await db.query("SELECT public.purge_activity_raw(180) AS n");
  assert.equal(r.rows[0].n, 0);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM public.activity_event_raw WHERE event_id = $1", [ev.id])).rows[0].n, 1);
});

// ── Acesso ──────────────────────────────────────────────────────────────────
test("usuário autenticado só enxerga eventos da própria org", async () => {
  await db.exec("BEGIN");
  try {
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [USER_A]);
    await db.exec("SET LOCAL ROLE authenticated");
    const r = await db.query("SELECT DISTINCT org_id FROM public.activity_events");
    assert.deepEqual(r.rows.map((x) => x.org_id), [ORG_A]);
    await assert.rejects(() => db.query("SELECT * FROM public.activity_event_raw"), /permission denied/);
  } finally {
    await db.exec("ROLLBACK");
  }
});

test("usuário autenticado não executa as funções de escrita", async () => {
  await db.exec("BEGIN");
  try {
    await db.exec("SET LOCAL ROLE authenticated");
    await assert.rejects(() => db.query("SELECT * FROM public.insert_activity_events($1, '[]'::jsonb)", [ORG_A]), /permission denied/);
  } finally {
    await db.exec("ROLLBACK");
  }
});

// ── Sincronização: trava, batimento e cobertura (T3b) ───────────────────────
const acquire = async (org, account, trigger = "cron") =>
  (await db.query("SELECT * FROM public.acquire_activity_sync_run($1, $2, $3)", [org, account, trigger])).rows[0];

test("só uma sincronização por conta por vez", async () => {
  const first = await acquire(ORG_A, ACC_A);
  assert.equal(first.reason, "acquired");
  assert.ok(first.run_id);
  const second = await acquire(ORG_A, ACC_A);
  assert.deepEqual(second, { run_id: null, reason: "running" });
  const done = await db.query("SELECT public.finish_activity_sync_run($1, 'succeeded', 10, 8, 2, NULL, NULL) AS ok", [first.run_id]);
  assert.equal(done.rows[0].ok, true);
  assert.equal((await acquire(ORG_A, ACC_A)).reason, "acquired");
});

test("execução sem batimento há 3 min vira stale e libera a conta", async () => {
  const running = (await db.query("SELECT id FROM public.activity_sync_runs WHERE ad_account_id = $1 AND status = 'running'", [ACC_A])).rows[0];
  await db.query("UPDATE public.activity_sync_runs SET heartbeat_at = now() - interval '4 minutes' WHERE id = $1", [running.id]);
  const next = await acquire(ORG_A, ACC_A);
  assert.equal(next.reason, "acquired");
  const old = (await db.query("SELECT status FROM public.activity_sync_runs WHERE id = $1", [running.id])).rows[0];
  assert.equal(old.status, "stale");
  const late = await db.query("SELECT public.finish_activity_sync_run($1, 'succeeded', 0, 0, 0, NULL, NULL) AS ok", [running.id]);
  assert.equal(late.rows[0].ok, false);
  await db.query("SELECT public.finish_activity_sync_run($1, 'succeeded', 0, 0, 0, NULL, NULL)", [next.run_id]);
});

test("batimento mantém a execução viva", async () => {
  const run = await acquire(ORG_A, ACC_ORPHAN);
  const hb = await db.query("SELECT public.heartbeat_activity_sync_run($1, 100, 90, 10) AS ok", [run.run_id]);
  assert.equal(hb.rows[0].ok, true);
  const row = (await db.query("SELECT fetched, inserted, duplicates FROM public.activity_sync_runs WHERE id = $1", [run.run_id])).rows[0];
  assert.deepEqual(row, { fetched: 100, inserted: 90, duplicates: 10 });
  await db.query("SELECT public.finish_activity_sync_run($1, 'partial', 100, 90, 10, 'rate_limited', 'limite da Meta')", [run.run_id]);
});

test("sincronização manual: no máximo uma a cada 5 min por conta", async () => {
  const first = await acquire(ORG_A, ACC_ORPHAN, "manual");
  assert.equal(first.reason, "acquired");
  await db.query("SELECT public.finish_activity_sync_run($1, 'succeeded', 0, 0, 0, NULL, NULL)", [first.run_id]);
  assert.deepEqual(await acquire(ORG_A, ACC_ORPHAN, "manual"), { run_id: null, reason: "rate_limited" });
  assert.equal((await acquire(ORG_A, ACC_ORPHAN, "cron")).reason, "acquired");
});

test("conta de outra org não sincroniza", async () => {
  await assert.rejects(() => acquire(ORG_A, ACC_B), /ACCOUNT_NOT_IN_ORG/);
});

test("cobertura do dia nunca regride de completo para parcial", async () => {
  const cov = (status, events) => db.query("SELECT public.record_activity_coverage($1, $2, '2026-10-13', $3, $4)", [ORG_A, ACC_A, status, events]);
  await cov("partial", 50);
  await cov("complete", 120);
  await cov("partial", 30);
  const row = (await db.query("SELECT status, events FROM public.activity_sync_coverage WHERE ad_account_id = $1 AND day = '2026-10-13'", [ACC_A])).rows[0];
  assert.deepEqual(row, { status: "complete", events: 120 });
  await assert.rejects(() => db.query("SELECT public.record_activity_coverage($1, $2, '2026-10-13', 'complete', 1)", [ORG_A, ACC_B]), /ACCOUNT_NOT_IN_ORG/);
});

// ── Google Ads: conexões, campanhas e métricas ──────────────────────────────
const GOOGLE_ACC = "00000000-0000-0000-0000-00000000900a";

test("conta Google entra em ad_accounts e métricas fazem upsert idempotente", async () => {
  await db.query("INSERT INTO public.ad_accounts (id, org_id, client_id, platform, external_id, name) VALUES ($1, $2, $3, 'google', '3418489444', 'Arroba')", [GOOGLE_ACC, ORG_A, CLIENT_A1]);
  const up = `INSERT INTO public.google_ads_daily_metrics (org_id, ad_account_id, campaign_id, date, cost_micros, impressions, clicks, conversions, conversions_value)
    VALUES ($1, $2, '22001', '2026-10-13', $3, 1000, 40, 2.5, 100)
    ON CONFLICT (ad_account_id, campaign_id, date) DO UPDATE SET cost_micros = EXCLUDED.cost_micros`;
  await db.query(up, [ORG_A, GOOGLE_ACC, 12_340_000]);
  await db.query(up, [ORG_A, GOOGLE_ACC, 15_000_000]);
  const rows = (await db.query("SELECT cost_micros::text AS c FROM public.google_ads_daily_metrics WHERE ad_account_id = $1", [GOOGLE_ACC])).rows;
  assert.deepEqual(rows, [{ c: "15000000" }]);
});

test("métricas extras do Google: upsert parcial não apaga as principais; parcela fora de 0–1 é recusada", async () => {
  await db.query(
    `INSERT INTO public.google_ads_daily_metrics (org_id, ad_account_id, campaign_id, date, interactions, all_conversions, search_impression_share, video_view_rate)
     VALUES ($1, $2, '22001', '2026-10-13', 50, 3.5, 0.62, NULL)
     ON CONFLICT (ad_account_id, campaign_id, date) DO UPDATE SET interactions = EXCLUDED.interactions,
       all_conversions = EXCLUDED.all_conversions, search_impression_share = EXCLUDED.search_impression_share`,
    [ORG_A, GOOGLE_ACC],
  );
  const row = (await db.query(
    "SELECT cost_micros::text AS c, interactions::text AS i, search_impression_share::text AS s, video_views::text AS v FROM public.google_ads_daily_metrics WHERE ad_account_id = $1 AND campaign_id = '22001'",
    [GOOGLE_ACC],
  )).rows[0];
  assert.deepEqual(row, { c: "15000000", i: "50", s: "0.62000", v: "0" });
  await assert.rejects(
    () => db.query("UPDATE public.google_ads_daily_metrics SET search_impression_share = 1.5 WHERE ad_account_id = $1", [GOOGLE_ACC]),
    /check constraint/,
  );
});

test("métrica do Google com conta de outra org é recusada", async () => {
  await assert.rejects(
    () => db.query("INSERT INTO public.google_ads_daily_metrics (org_id, ad_account_id, campaign_id, date) VALUES ($1, $2, '1', '2026-10-13')", [ORG_B, GOOGLE_ACC]),
    /violates foreign key/,
  );
});

test("conexão OAuth exige refresh token; uma conexão por modo por org", async () => {
  await assert.rejects(() => db.query("INSERT INTO public.google_ads_connections (org_id, mode) VALUES ($1, 'oauth')", [ORG_A]), /violates check/);
  await db.query("INSERT INTO public.google_ads_connections (org_id, mode, login_customer_id) VALUES ($1, 'service_account', '7205749286')", [ORG_A]);
  await assert.rejects(() => db.query("INSERT INTO public.google_ads_connections (org_id, mode) VALUES ($1, 'service_account')", [ORG_A]), /duplicate key/);
});

test("usuário autenticado lê métricas só da própria org e nunca lê as conexões", async () => {
  await db.exec("BEGIN");
  try {
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [USER_A]);
    await db.exec("SET LOCAL ROLE authenticated");
    const r = await db.query("SELECT DISTINCT org_id FROM public.google_ads_daily_metrics");
    assert.deepEqual(r.rows.map((x) => x.org_id), [ORG_A]);
    await assert.rejects(() => db.query("SELECT * FROM public.google_ads_connections"), /permission denied/);
  } finally {
    await db.exec("ROLLBACK");
  }
});

// ── Segmentos e produtos dos clientes ──────────────────────────────────────
const SEG_A = "00000000-0000-0000-0000-00000000500a";
const SEG_B = "00000000-0000-0000-0000-00000000500b";
const PROD_A = "00000000-0000-0000-0000-00000000700a";

test("segmento e produto: um nome por org (sem diferença de maiúsculas) e cor em hexadecimal", async () => {
  await db.query("INSERT INTO public.client_segments (id, org_id, name, color) VALUES ($1, $2, 'Imobiliário', '#0f766e')", [SEG_A, ORG_A]);
  await db.query("INSERT INTO public.client_segments (id, org_id, name) VALUES ($1, $2, 'Imobiliário')", [SEG_B, ORG_B]);
  await db.query("INSERT INTO public.client_products (id, org_id, name) VALUES ($1, $2, 'Tráfego + Social')", [PROD_A, ORG_A]);
  await assert.rejects(() => db.query("INSERT INTO public.client_segments (org_id, name) VALUES ($1, ' imobiliário ')", [ORG_A]), /duplicate key/);
  await assert.rejects(() => db.query("INSERT INTO public.client_products (org_id, name, color) VALUES ($1, 'X', 'verde')", [ORG_A]), /check constraint/);
  await assert.rejects(() => db.query("INSERT INTO public.client_products (org_id, name) VALUES ($1, '  ')", [ORG_A]), /check constraint/);
});

test("cliente só usa segmento/produto da própria org; apagar o segmento deixa o cliente sem segmento", async () => {
  await db.query("UPDATE public.clients SET segment_id = $1, product_id = $2 WHERE id = $3", [SEG_A, PROD_A, CLIENT_A1]);
  await assert.rejects(() => db.query("UPDATE public.clients SET segment_id = $1 WHERE id = $2", [SEG_B, CLIENT_A1]), /violates foreign key/);
  await db.query("DELETE FROM public.client_segments WHERE id = $1", [SEG_A]);
  const row = (await db.query("SELECT segment_id, product_id FROM public.clients WHERE id = $1", [CLIENT_A1])).rows[0];
  assert.deepEqual(row, { segment_id: null, product_id: PROD_A });
});

test("segmentos: usuário autenticado só enxerga e grava os da própria org", async () => {
  await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${USER_A}', false);`);
  try {
    const seen = (await db.query("SELECT org_id FROM public.client_segments")).rows;
    assert.ok(seen.every((r) => r.org_id === ORG_A));
    await assert.rejects(() => db.query("INSERT INTO public.client_products (org_id, name) VALUES ($1, 'Invasor')", [ORG_B]), /row-level security/);
  } finally {
    await db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.sub', '', false);");
  }
});

// ── Regras automáticas ─────────────────────────────────────────────────────
const RULE_A = "00000000-0000-0000-0000-0000000a0001";

test("regra automática: nasce simulando; orçamento exige porcentagem; conta de outra org é recusada", async () => {
  await db.query(
    `INSERT INTO public.automation_rules (id, org_id, ad_account_id, name, platform, metric, operator, value, action)
     VALUES ($1, $2, $3, 'CPA alto pausa', 'meta', 'cpa', 'above', 50, 'pause')`,
    [RULE_A, ORG_A, ACC_A],
  );
  const row = (await db.query("SELECT mode, is_active, cooldown_hours, max_actions_per_day FROM public.automation_rules WHERE id = $1", [RULE_A])).rows[0];
  assert.deepEqual(row, { mode: "simulate", is_active: true, cooldown_hours: 24, max_actions_per_day: 3 });
  await assert.rejects(
    () => db.query(`INSERT INTO public.automation_rules (org_id, ad_account_id, name, platform, metric, operator, value, action)
      VALUES ($1, $2, 'sem %', 'meta', 'roas', 'above', 3, 'increase_budget')`, [ORG_A, ACC_A]),
    /check constraint/,
  );
  await assert.rejects(
    () => db.query(`INSERT INTO public.automation_rules (org_id, ad_account_id, name, platform, metric, operator, value, action)
      VALUES ($1, $2, 'invasora', 'meta', 'cpa', 'above', 50, 'pause')`, [ORG_B, ACC_A]),
    /violates foreign key/,
  );
});

test("execuções da regra: status válidos e somem junto com a regra", async () => {
  await db.query(
    `INSERT INTO public.automation_runs (org_id, rule_id, entity_external_id, entity_name, metric_value, action, mode, status)
     VALUES ($1, $2, '120001', 'Campanha X', 75, 'pause', 'simulate', 'simulated')`,
    [ORG_A, RULE_A],
  );
  await assert.rejects(
    () => db.query(`INSERT INTO public.automation_runs (org_id, rule_id, entity_external_id, action, mode, status)
      VALUES ($1, $2, '1', 'pause', 'simulate', 'talvez')`, [ORG_A, RULE_A]),
    /check constraint/,
  );
  await db.query("DELETE FROM public.automation_rules WHERE id = $1", [RULE_A]);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM public.automation_runs WHERE rule_id = $1", [RULE_A])).rows[0].n, 0);
});

test("regras: usuário autenticado não vê nem cria regra de outra org; execuções são só leitura", async () => {
  await db.query(
    `INSERT INTO public.automation_rules (org_id, ad_account_id, name, platform, metric, operator, value, action)
     VALUES ($1, $2, 'da org B', 'meta', 'cpa', 'above', 50, 'notify')`,
    [ORG_B, ACC_B],
  );
  await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${USER_A}', false);`);
  try {
    const seen = (await db.query("SELECT org_id FROM public.automation_rules")).rows;
    assert.ok(seen.every((r) => r.org_id === ORG_A));
    await assert.rejects(
      () => db.query(`INSERT INTO public.automation_rules (org_id, ad_account_id, name, platform, metric, operator, value, action)
        VALUES ($1, $2, 'x', 'meta', 'cpa', 'above', 50, 'notify')`, [ORG_B, ACC_B]),
      /row-level security|permission denied/,
    );
    await assert.rejects(
      () => db.query(`INSERT INTO public.automation_runs (org_id, rule_id, entity_external_id, action, mode, status)
        VALUES ($1, gen_random_uuid(), '1', 'pause', 'simulate', 'simulated')`, [ORG_A]),
      /permission denied|row-level security/,
    );
  } finally {
    await db.exec("RESET ROLE; SELECT set_config('request.jwt.claim.sub', '', false);");
  }
});
