// Rodar de apps/dashboard: node --test scripts/overview-funnel.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

const funnel = await import("../src/lib/dashboard/funnel.ts");

const row = (date, campaign_id, actions) => ({ date, campaign_id, actions });

test("linhas sem ações sincronizadas deixam a cobertura parcial ou nula", () => {
  assert.equal(funnel.summarizeActionRows([]).coverage, "none");
  assert.equal(funnel.summarizeActionRows([row("2026-10-01", "c1", null)]).coverage, "none");
  const partial = funnel.summarizeActionRows([row("2026-10-01", "c1", null), row("2026-10-02", "c1", { lead: 2 })]);
  assert.equal(partial.coverage, "partial");
  const complete = funnel.summarizeActionRows([row("2026-10-01", "c1", { lead: 2 }), row("2026-10-01", "c2", { lead: "3" })]);
  assert.equal(complete.coverage, "complete");
  assert.equal(complete.total.lead, 5);
  assert.equal(complete.byDay["2026-10-01"].lead, 5);
  assert.equal(complete.byCampaign.c2.lead, 3);
});

test("resultado principal não soma tipos equivalentes de compra", () => {
  const r = funnel.extractActionResults({ purchase: 4, omni_purchase: 4, lead: 1, link_click: 90 });
  assert.equal(r.primaryType, "compras");
  assert.equal(r.results, 4);
  assert.equal(r.linkClicks, 90);
  const msg = funnel.extractActionResults({ "onsite_conversion.messaging_conversation_started_7d": 7 });
  assert.equal(msg.primaryType, "mensagens");
  assert.equal(msg.results, 7);
});

test("sem ações sincronizadas as etapas da Meta ficam vazias, nunca zero", () => {
  const model = funnel.buildFunnel(5000, 40, { coverage: "partial", total: {}, byDay: {}, byCampaign: {} });
  assert.equal(model.etapas[0].valor, 5000);
  assert.deepEqual(model.etapas.slice(1).map((s) => s.valor), [null, null, null, null]);
  assert.equal(model.aguardandoSync, true);
  assert.equal(model.gargalo.etapa, "—");
});

test("sem métricas no período não aponta gargalo", () => {
  const model = funnel.buildFunnel(null, null, null);
  assert.equal(model.gargalo.etapa, "—");
  assert.equal(model.aguardandoSync, false);
});

test("gargalo aponta o criativo quando o CTR do link é baixo", () => {
  const actions = funnel.summarizeActionRows([row("2026-10-01", "c1", { link_click: 5, landing_page_view: 4, lead: 1 })]);
  const model = funnel.buildFunnel(10000, 20, actions);
  assert.equal(model.etapas[1].valor, 5);
  assert.equal(model.etapas[4].nome, "Resultados (leads)");
  assert.match(model.gargalo.etapa, /Criativo/);
});

test("gargalo aponta o fechamento quando poucos concluem o checkout", () => {
  const actions = funnel.summarizeActionRows([
    row("2026-10-01", "c1", { link_click: 200, landing_page_view: 180, initiate_checkout: 40, purchase: 4 }),
  ]);
  const model = funnel.buildFunnel(10000, 220, actions);
  assert.equal(model.etapas[4].nome, "Compras");
  assert.match(model.gargalo.etapa, /Fechamento/);
  assert.equal(model.etapas[2].pctAnterior, 90);
});

test("funil equilibrado quando nenhuma etapa trava", () => {
  const actions = funnel.summarizeActionRows([
    row("2026-10-01", "c1", { link_click: 200, landing_page_view: 180, initiate_checkout: 40, purchase: 20 }),
  ]);
  const model = funnel.buildFunnel(10000, 220, actions);
  assert.equal(model.gargalo.etapa, "Nenhum");
  assert.equal(model.gargalo.resolvido, true);
});
