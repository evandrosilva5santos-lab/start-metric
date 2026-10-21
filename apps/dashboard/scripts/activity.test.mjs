// Rodar de apps/dashboard: node --test scripts/activity.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const { parseGraphText, parseExtraData } = await import("../src/lib/activity/meta/parse.ts");
const { normalizeMetaActivity } = await import("../src/lib/activity/meta/normalize.ts");
const { assignDedupeKeys, DEDUPE_VERSION } = await import("../src/lib/activity/meta/dedupe.ts");
const { classifyActivity, CLASSIFIER_VERSION } = await import("../src/lib/activity/classify.ts");
const { describeActivity, formatMoneyMinor } = await import("../src/lib/activity/format/describe.ts");

const STARTMETRIC_APP_ID = "1471696211057442";
const CTX = { accountExternalId: "act_700000000000001", startMetricAppId: STARTMETRIC_APP_ID };
const fixture = (name) => readFileSync(new URL(`./fixtures/activity/${name}`, import.meta.url), "utf8");
const loadWindow = (name) => parseGraphText(fixture(name)).data.map((raw) => normalizeMetaActivity(raw, CTX));
const byType = (list, type, objectId) =>
  list.find((n) => n.eventType === type && (objectId === undefined || n.objectExternalId === objectId));
const plain = (s) => s.replace(/ /g, " ");

const windowA = loadWindow("window-a.json");
const windowB = loadWindow("window-b.json");

// ── Leitura sem perdas ──────────────────────────────────────────────────────
test("parseExtraData preserva ids de 64 bits como texto", () => {
  const extra = parseExtraData('{"campaign_id":120252399320470101,"run_status":{"old_value":1,"new_value":15}}');
  assert.equal(extra.campaign_id, "120252399320470101");
  assert.equal(extra.run_status.new_value, 15);
});

test("parseExtraData devolve null para texto vazio ou inválido", () => {
  assert.equal(parseExtraData(undefined), null);
  assert.equal(parseExtraData(""), null);
  assert.equal(parseExtraData("{quebrado"), null);
});

test("parseGraphText preserva ids grandes no nível de cima", () => {
  const parsed = parseGraphText('{"data":[{"object_id":120252399320470229}]}');
  assert.equal(parsed.data[0].object_id, "120252399320470229");
});

// ── Normalização ────────────────────────────────────────────────────────────
test("event_time da Meta vira ISO em UTC", () => {
  assert.equal(byType(windowA, "update_ad_set_budget").occurredAt, "2026-10-13T12:35:10.000Z");
});

test("nomes legados da Meta viram o nível certo do objeto", () => {
  assert.equal(byType(windowA, "update_campaign_run_status").objectLevel, "campaign");
  assert.equal(byType(windowA, "update_ad_set_budget").objectLevel, "ad_set");
  assert.equal(byType(windowA, "create_ad").objectLevel, "ad");
  assert.equal(byType(windowA, "share_audience").objectLevel, "audience");
  assert.equal(byType(windowA, "create_audience").objectLevel, "audience");
  assert.equal(byType(windowA, "add_images").objectLevel, "creative_library");
  assert.equal(byType(windowA, "ad_account_billing_charge").objectLevel, "account");
});

test("campaign_id de evento de anúncio é o conjunto, nos dois formatos da Meta", () => {
  const pause = byType(windowA, "update_ad_run_status", "120252399320470230");
  assert.equal(pause.adSetExternalId, "120252399320470101");
  assert.equal(pause.campaignExternalId, null);
  assert.equal(byType(windowA, "create_ad").adSetExternalId, "120252399320470101");
});

test("evento de campanha aponta a própria campanha", () => {
  const n = byType(windowA, "update_campaign_run_status");
  assert.equal(n.campaignExternalId, "120252399320470100");
});

test("autoria: Meta é plataforma, app do Start Metric é integração, resto é pessoa", () => {
  assert.equal(byType(windowA, "first_delivery_event").actorKind, "platform");
  assert.equal(byType(windowA, "create_ad").actorKind, "integration");
  assert.equal(byType(windowA, "update_ad_set_budget").actorKind, "person");
  assert.equal(byType(windowA, "update_ad_set_budget").appName, "Power Editor");
});

test("orçamento vira valor em centavos com moeda e período", () => {
  const n = byType(windowA, "update_ad_set_budget");
  assert.deepEqual(n.before, { amountMinor: 5000, currency: "BRL", period: "daily" });
  assert.deepEqual(n.after, { amountMinor: 8000, currency: "BRL", period: "daily" });
});

test("status guarda o código numérico, que não depende do idioma", () => {
  const n = byType(windowA, "update_ad_run_status", "120252399320470230");
  assert.deepEqual(n.before, { statusCode: 1, label: "Ativo" });
  assert.deepEqual(n.after, { statusCode: 15, label: "Inativo" });
});

test("nenhuma URL assinada sobrevive à normalização", () => {
  assert.ok(!JSON.stringify(windowA).includes("fbcdn"));
  assert.ok(!JSON.stringify(windowA).includes("http"));
});

// ── Dedupe ──────────────────────────────────────────────────────────────────
test("as duas capturas da mesma janela geram as mesmas chaves", () => {
  const keysA = assignDedupeKeys(windowA).map((n) => n.dedupeKey).sort();
  const keysB = assignDedupeKeys(windowB).map((n) => n.dedupeKey).sort();
  assert.deepEqual(keysA, keysB);
});

test("eventos idênticos no mesmo segundo recebem chaves diferentes (ordinal)", () => {
  const keys = assignDedupeKeys(windowA).map((n) => n.dedupeKey);
  assert.equal(new Set(keys).size, windowA.length);
  const shares = assignDedupeKeys(windowA).filter((n) => n.eventType === "share_audience");
  assert.deepEqual(shares.map((n) => n.dedupeKey.split(":").at(-1)).sort(), ["0", "1"]);
});

test("a chave carrega a versão e muda quando muda um valor estável", () => {
  const [budget] = assignDedupeKeys([byType(windowA, "update_ad_set_budget")]);
  assert.ok(budget.dedupeKey.startsWith(`meta:v${DEDUPE_VERSION}:act_700000000000001:`));
  const changed = { ...byType(windowA, "update_ad_set_budget"), after: { amountMinor: 9000, currency: "BRL", period: "daily" } };
  const [other] = assignDedupeKeys([changed]);
  assert.notEqual(budget.dedupeKey, other.dedupeKey);
});

// ── Classificação ───────────────────────────────────────────────────────────
const cls = (type, objectId) => classifyActivity(byType(windowA, type, objectId));

test("versão do classificador é exposta", () => {
  assert.equal(typeof CLASSIFIER_VERSION, "number");
});

test("pausa feita por pessoa conta como trabalho", () => {
  assert.deepEqual(cls("update_ad_run_status", "120252399320470230"), { category: "status", action: "ad.paused", countsAsWork: true });
});

test("aprovação automática da Meta não conta", () => {
  const c = cls("update_ad_run_status", "120252399320470229");
  assert.equal(c.category, "platform");
  assert.equal(c.countsAsWork, false);
});

test("transição de revisão atribuída a pessoa é efeito colateral e não conta", () => {
  const c = cls("update_ad_run_status", "120252399320470231");
  assert.equal(c.countsAsWork, false);
  assert.equal(c.action, "ad.review_transition");
});

test("decisões humanas contam, com a categoria certa", () => {
  assert.deepEqual(cls("update_ad_set_budget"), { category: "budget", action: "ad_set.budget_changed", countsAsWork: true });
  assert.equal(cls("update_ad_set_target_spec").category, "targeting");
  assert.equal(cls("update_ad_set_bid_strategy").category, "bidding");
  assert.equal(cls("create_ad").category, "creative");
  assert.equal(cls("add_images").category, "creative");
  assert.equal(cls("update_campaign_group_budget_scheduling_state").category, "budget");
  assert.equal(cls("update_campaign_run_status").action, "campaign.paused");
  for (const t of ["update_ad_set_budget", "update_ad_set_target_spec", "update_ad_set_bid_strategy", "create_ad", "share_audience", "update_campaign_run_status"]) {
    assert.equal(cls(t).countsAsWork, true, t);
  }
});

test("cobrança, entrega e público automático não contam", () => {
  assert.deepEqual(cls("ad_account_billing_charge"), { category: "billing", action: "account.billing_charge", countsAsWork: false });
  assert.equal(cls("first_delivery_event").countsAsWork, false);
  assert.equal(cls("create_audience").countsAsWork, false);
});

test("tipo desconhecido não é inventado como trabalho", () => {
  assert.deepEqual(cls("some_future_event"), { category: "other", action: "unknown", countsAsWork: false });
});

// ── Formatação ──────────────────────────────────────────────────────────────
const desc = (type, objectId) => describeActivity(byType(windowA, type, objectId));

test("formatMoneyMinor usa as casas decimais da moeda", () => {
  assert.equal(plain(formatMoneyMinor(5000, "BRL")), "R$ 50,00");
  assert.equal(plain(formatMoneyMinor(1500, "JPY")), "JP¥ 1.500");
});

test("orçamento vira frase em reais, não em centavos", () => {
  const d = desc("update_ad_set_budget");
  assert.equal(d.title, "Orçamento diário alterado");
  assert.equal(plain(d.detail), "RMKT | Compra · de R$ 50,00 para R$ 80,00 por dia");
});

test("status traduz o código, não o texto da Meta", () => {
  assert.equal(desc("update_ad_run_status", "120252399320470230").title, "Anúncio pausado");
  assert.equal(desc("update_campaign_run_status").title, "Campanha pausada");
});

test("título nunca contradiz o dado da Meta", () => {
  assert.equal(desc("update_campaign_group_budget_scheduling_state").title, "Programação de orçamento desativada");
});

test("nenhum título fica em inglês e todos existem", () => {
  for (const n of windowA) {
    const d = describeActivity(n);
    assert.ok(d.title.length > 0, n.eventType);
    assert.ok(!/audience|shared|custom/i.test(d.title), d.title);
  }
  assert.equal(desc("share_audience").title, "Público compartilhado");
});

test("estratégia de lance aparece em português", () => {
  assert.equal(desc("update_ad_set_bid_strategy").detail, "Público frio POA · Menor custo");
});

test("direcionamento mostra só o que mudou", () => {
  assert.equal(desc("update_ad_set_target_spec").detail, "Público frio POA · Localização: Cidade Exemplo (+40 km) → Cidade Exemplo (+80 km)");
});
