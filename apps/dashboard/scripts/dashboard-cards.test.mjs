// Rodar de apps/dashboard: node --test scripts/dashboard-cards.test.mjs
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

const { CARD_CATALOG, CARD_BY_SLUG, CARD_GROUPS, MAX_CARDS } = await import("../src/lib/dashboard/cards/catalog.ts");
const { objectiveKindOf, detectObjective, defaultLayoutFor, defaultSourceLabel, OBJECTIVE_KINDS } = await import(
  "../src/lib/dashboard/cards/objective.ts"
);
const { validateCardSlugs, sanitizeStoredCards, summarizeRows, computeCardValues, formatCardValue, moveItem, sameCards } =
  await import("../src/lib/dashboard/cards/layout.ts");
const { VARIABLE_BY_SLUG } = await import("../src/lib/reports/engine/catalog.ts");

const plain = (s) => s.replace(/ /g, " ");
const SPEND = "meta_spend";
const MESSAGES = "meta_actions.onsite_conversion_messaging_first_reply";
const COST_PER_MESSAGE = "meta_cost_per_action.onsite_conversion_messaging_first_reply";
const LEADS = "meta_actions.lead";
const COST_PER_LEAD = "meta_cost_per_action.lead";
const ROAS = "meta_roas";
const REVENUE = "meta_action_values.purchase";

test("catálogo usa só slugs do catálogo de relatórios, sem repetir, com formato compatível", () => {
  const slugs = CARD_CATALOG.map((c) => c.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const card of CARD_CATALOG) {
    const variable = VARIABLE_BY_SLUG.get(card.slug);
    assert.ok(variable, `${card.slug} não está no catálogo de relatórios`);
    const expected = card.format === "ratio" ? "number" : card.format;
    assert.equal(variable.returns, expected, card.slug);
  }
});

test("catálogo não oferece métricas que daily_metrics não tem (alcance, frequência)", () => {
  assert.equal(CARD_BY_SLUG.has("meta_reach"), false);
  assert.equal(CARD_BY_SLUG.has("meta_frequency"), false);
});

test("grupos seguem a ordem combinada e todo card pertence a um grupo", () => {
  assert.deepEqual(
    CARD_GROUPS.map((g) => g.label),
    ["Investimento", "Entrega", "Cliques", "Mensagens", "Leads", "Vendas", "Custos"],
  );
  const ids = new Set(CARD_GROUPS.map((g) => g.id));
  for (const card of CARD_CATALOG) assert.ok(ids.has(card.group), card.slug);
  for (const group of CARD_GROUPS) assert.ok(CARD_CATALOG.some((c) => c.group === group.id), group.label);
});

test("objetivos da Meta (novos e legados) viram um tipo de padrão", () => {
  assert.equal(objectiveKindOf("OUTCOME_LEADS"), "leads");
  assert.equal(objectiveKindOf("LEAD_GENERATION"), "leads");
  assert.equal(objectiveKindOf("OUTCOME_SALES"), "sales");
  assert.equal(objectiveKindOf("CONVERSIONS"), "sales");
  assert.equal(objectiveKindOf("MESSAGES"), "messages");
  assert.equal(objectiveKindOf("OUTCOME_ENGAGEMENT"), "messages");
  assert.equal(objectiveKindOf("outcome_traffic"), "traffic");
  assert.equal(objectiveKindOf("LINK_CLICKS"), "traffic");
  assert.equal(objectiveKindOf("OUTCOME_AWARENESS"), "awareness");
  assert.equal(objectiveKindOf("REACH"), "awareness");
  assert.equal(objectiveKindOf(null), null);
  assert.equal(objectiveKindOf("OUTCOME_APP_PROMOTION"), null);
});

test("objetivo do cliente é o que mais gastou, não o que tem mais campanhas", () => {
  const kind = detectObjective([
    { objective: "OUTCOME_SALES", spend: 50 },
    { objective: "OUTCOME_SALES", spend: 40 },
    { objective: "MESSAGES", spend: 300 },
  ]);
  assert.equal(kind, "messages");
});

test("sem gasto no período o objetivo sai pela quantidade de campanhas", () => {
  const kind = detectObjective([
    { objective: "OUTCOME_LEADS", spend: null },
    { objective: "OUTCOME_LEADS", spend: 0 },
    { objective: "OUTCOME_TRAFFIC", spend: null },
  ]);
  assert.equal(kind, "leads");
});

test("empate desempata por vendas > leads > mensagens; nada mapeado volta null", () => {
  assert.equal(detectObjective([{ objective: "MESSAGES", spend: 10 }, { objective: "OUTCOME_SALES", spend: 10 }]), "sales");
  assert.equal(detectObjective([{ objective: "OUTCOME_APP_PROMOTION", spend: 100 }]), null);
  assert.equal(detectObjective([]), null);
});

test("padrão de mensagens não tem ROAS e começa com investimento, mensagens e custo por mensagem", () => {
  const cards = defaultLayoutFor("messages");
  assert.deepEqual(cards.slice(0, 3), [SPEND, MESSAGES, COST_PER_MESSAGE]);
  assert.ok(cards.includes("meta_ctr"));
  assert.ok(cards.includes("meta_cpm"));
  assert.equal(cards.includes(ROAS), false);
  assert.equal(cards.includes(REVENUE), false);
});

test("padrão de leads mostra leads e custo por lead; vendas mostra receita, ROAS e compras", () => {
  assert.ok(defaultLayoutFor("leads").includes(LEADS));
  assert.ok(defaultLayoutFor("leads").includes(COST_PER_LEAD));
  assert.equal(defaultLayoutFor("leads").includes(ROAS), false);
  const sales = defaultLayoutFor("sales");
  for (const slug of [REVENUE, ROAS, "meta_actions.purchase", "meta_cost_per_action.purchase"]) assert.ok(sales.includes(slug), slug);
});

test("todo padrão é válido: slugs conhecidos, sem repetir, dentro do limite", () => {
  for (const kind of [...OBJECTIVE_KINDS, null]) {
    const cards = defaultLayoutFor(kind);
    assert.ok(cards.length > 0 && cards.length <= MAX_CARDS);
    assert.deepEqual(validateCardSlugs(cards), { ok: true, cards });
  }
  assert.equal(defaultSourceLabel("messages"), "Padrão para campanhas de mensagens");
  assert.equal(defaultSourceLabel(null), "Padrão geral (objetivo não identificado)");
});

test("validação recusa slug desconhecido, excesso e lista vazia; remove repetidos", () => {
  assert.deepEqual(validateCardSlugs([SPEND, SPEND, MESSAGES]), { ok: true, cards: [SPEND, MESSAGES] });
  assert.equal(validateCardSlugs(["meta_reach"]).ok, false);
  assert.equal(validateCardSlugs([]).ok, false);
  assert.equal(validateCardSlugs("meta_spend").ok, false);
  assert.equal(validateCardSlugs([1, 2]).ok, false);
  const tooMany = CARD_CATALOG.slice(0, MAX_CARDS + 1).map((c) => c.slug);
  assert.equal(validateCardSlugs(tooMany).ok, false);
});

test("layout salvo no banco é limpo com tolerância e vazio vira null (usa o padrão)", () => {
  assert.deepEqual(sanitizeStoredCards([SPEND, "removido", SPEND, LEADS]), [SPEND, LEADS]);
  assert.equal(sanitizeStoredCards(["removido"]), null);
  assert.equal(sanitizeStoredCards(null), null);
  assert.equal(sanitizeStoredCards({ cards: [] }), null);
  const all = CARD_CATALOG.map((c) => c.slug);
  assert.equal(sanitizeStoredCards(all).length, MAX_CARDS);
});

const row = (spend, actions, extra = {}) => ({ spend, impressions: 1000, clicks: 20, conversions: 2, revenue_attributed: null, actions, ...extra });

test("custo por mensagem vem do gasto ÷ mensagens iniciadas, sem somar tipos equivalentes", () => {
  const current = summarizeRows([
    row(100, { "onsite_conversion.messaging_conversation_started_7d": 8, "onsite_conversion.messaging_first_reply": 5 }),
    row(60, { "onsite_conversion.messaging_conversation_started_7d": 2 }),
  ]);
  const [messages, cost] = computeCardValues([MESSAGES, COST_PER_MESSAGE], current, null);
  assert.equal(messages.value, 10);
  assert.equal(cost.value, 16);
  assert.equal(messages.delta, undefined);
});

test("variação compara com o período anterior em pontos percentuais", () => {
  const current = summarizeRows([row(150, { lead: 10 })]);
  const previous = summarizeRows([row(100, { lead: 5 })]);
  const [spend, leads, cpl] = computeCardValues([SPEND, LEADS, COST_PER_LEAD], current, previous);
  assert.equal(spend.delta, 50);
  assert.equal(leads.delta, 100);
  assert.equal(cpl.value, 15);
  assert.equal(cpl.previous, 20);
  assert.equal(cpl.delta, -25);
});

test("ações não sincronizadas em todo o período ficam vazias, nunca zero", () => {
  const partial = summarizeRows([row(100, { lead: 3 }), row(50, null)]);
  const [leads, cpl, spend] = computeCardValues([LEADS, COST_PER_LEAD, SPEND], partial, null);
  assert.equal(leads.value, null);
  assert.equal(cpl.value, null);
  assert.equal(leads.pending, true);
  assert.equal(spend.value, 150);
  assert.equal(spend.pending, false);
});

test("ações completas sem o evento contam zero e o custo fica vazio", () => {
  const complete = summarizeRows([row(100, { link_click: 30 })]);
  const [leads, cpl] = computeCardValues([LEADS, COST_PER_LEAD], complete, null);
  assert.equal(leads.value, 0);
  assert.equal(cpl.value, null);
});

test("sem linhas no período tudo fica vazio e sem variação", () => {
  const values = computeCardValues([SPEND, "meta_ctr", ROAS, LEADS], summarizeRows([]), summarizeRows([row(10, {})]));
  for (const card of values) {
    assert.equal(card.value, null, card.slug);
    assert.equal(card.delta, undefined, card.slug);
  }
});

test("receita usa a receita atribuída e ROAS bate com receita ÷ gasto", () => {
  const withRevenue = summarizeRows([row(100, { purchase: 2 }, { revenue_attributed: 450 })]);
  const [revenue, roas] = computeCardValues([REVENUE, ROAS], withRevenue, null);
  assert.equal(Math.round(revenue.value), 450);
  assert.equal(roas.value, 4.5);
  const pixelOnly = summarizeRows([row(100, { purchase: 2 }, { action_values: { "offsite_conversion.fb_pixel_purchase": 300 } })]);
  const [revenue2, roas2] = computeCardValues([REVENUE, ROAS], pixelOnly, null);
  assert.equal(revenue2.value, 300);
  assert.equal(roas2.value, 3);
  const zeroAttributed = summarizeRows([row(100, { purchase: 2 }, { revenue_attributed: 0, action_values: { purchase: 250 } })]);
  const [revenue3, roas3] = computeCardValues([REVENUE, ROAS], zeroAttributed, null);
  assert.equal(revenue3.value, 250);
  assert.equal(roas3.value, 2.5);
  const zeroEverywhere = summarizeRows([row(100, {}, { revenue_attributed: 0 })]);
  assert.equal(computeCardValues([ROAS], zeroEverywhere, null)[0].value, 0);
});

test("slugs desconhecidos são ignorados ao calcular", () => {
  const values = computeCardValues(["nao_existe", SPEND], summarizeRows([row(10, {})]), null);
  assert.deepEqual(values.map((v) => v.slug), [SPEND]);
  assert.equal(values[0].label, CARD_BY_SLUG.get(SPEND).label);
});

test("formatação: travessão para ausente, moeda, taxa, razão e valores ocultos", () => {
  assert.equal(formatCardValue("currency", null, false), "—");
  assert.equal(plain(formatCardValue("currency", 16, false)), "R$ 16,00");
  assert.equal(formatCardValue("percent", 1.5, false), "1,50%");
  assert.equal(formatCardValue("ratio", 4.5, false), "4,50x");
  assert.equal(formatCardValue("number", 1234, false), "1.234");
  assert.equal(formatCardValue("number", 0, false), "0");
  assert.equal(formatCardValue("currency", 10, true), "R$ •••••");
  assert.equal(formatCardValue("number", null, true), "—");
});

test("mover cards devolve nova lista sem alterar a original", () => {
  const list = ["a", "b", "c", "d"];
  assert.deepEqual(moveItem(list, 0, 2), ["b", "c", "a", "d"]);
  assert.deepEqual(moveItem(list, 3, 0), ["d", "a", "b", "c"]);
  assert.deepEqual(moveItem(list, 1, 9), list);
  assert.deepEqual(list, ["a", "b", "c", "d"]);
  assert.equal(sameCards(["a", "b"], ["a", "b"]), true);
  assert.equal(sameCards(["a", "b"], ["b", "a"]), false);
});
