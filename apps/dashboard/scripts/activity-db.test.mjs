// Rodar de apps/dashboard: node --test scripts/activity-db.test.mjs
// Testa a migration da Central de Histórico num Postgres em memória (PGlite). Nunca toca no banco real.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";

const MIGRATION = readFileSync(new URL("../supabase/migrations/20261022000000_activity_events.sql", import.meta.url), "utf8");

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
  await db.exec(MIGRATION);
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
