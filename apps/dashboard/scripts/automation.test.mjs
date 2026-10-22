// Rodar de apps/dashboard: node --test scripts/automation.test.mjs
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

const { decide, metricValue, nextBudget } = await import("../src/lib/automation/evaluate.ts");

const NOW = new Date("2026-10-22T15:00:00Z");
const rule = (over = {}) => ({
  id: "r1", metric: "cpa", operator: "above", value: 50, minSpend: 20, action: "pause", actionPercent: null,
  cooldownHours: 24, maxActionsPerDay: 3, ...over,
});
const entity = (over = {}) => ({
  externalId: "c1", name: "Campanha 1", status: "ACTIVE", dailyBudget: 100, budgetShared: false,
  metrics: { spend: 300, impressions: 10000, clicks: 200, conversions: 4, value: 600 }, ...over,
});

test("métrica: CPA, ROAS, CTR, CPC, CPM; sem conversão com gasto o CPA é infinito", () => {
  const e = entity();
  assert.equal(metricValue(e, "cpa"), 75);
  assert.equal(metricValue(e, "roas"), 2);
  assert.equal(metricValue(e, "ctr"), 2);
  assert.equal(metricValue(e, "cpc"), 1.5);
  assert.equal(metricValue(e, "cpm"), 30);
  assert.equal(metricValue(e, "spend"), 300);
  assert.equal(metricValue(e, "conversions"), 4);
  assert.equal(metricValue(entity({ metrics: { spend: 80, impressions: 1000, clicks: 10, conversions: 0, value: 0 } }), "cpa"), Infinity);
  assert.equal(metricValue(entity({ metrics: { spend: 0, impressions: 0, clicks: 0, conversions: 0, value: 0 } }), "cpa"), null);
});

test("decide: CPA acima do limite pausa a campanha ativa", () => {
  const [d] = decide(rule(), [entity()], [], NOW);
  assert.equal(d.action, "pause");
  assert.equal(d.metricValue, 75);
  assert.equal(d.skipped, null);
});

test("decide: não age abaixo do gasto mínimo, nem em campanha já pausada, nem quando a condição não bate", () => {
  assert.equal(decide(rule({ minSpend: 500 }), [entity()], [], NOW)[0].skipped, "gasto abaixo do mínimo");
  assert.equal(decide(rule(), [entity({ status: "PAUSED" })], [], NOW)[0].skipped, "já está pausada");
  assert.equal(decide(rule({ value: 100 }), [entity()], [], NOW).length, 0);
});

test("decide: carência por campanha e limite de ações por dia", () => {
  const recent = [{ entityExternalId: "c1", createdAt: "2026-10-22T05:00:00Z", status: "executed" }];
  assert.equal(decide(rule(), [entity()], recent, NOW)[0].skipped, "em carência");
  const old = [{ entityExternalId: "c1", createdAt: "2026-10-20T05:00:00Z", status: "executed" }];
  assert.equal(decide(rule(), [entity()], old, NOW)[0].skipped, null);
  const today = ["a", "b", "c"].map((id) => ({ entityExternalId: id, createdAt: "2026-10-22T10:00:00Z", status: "simulated" }));
  assert.equal(decide(rule(), [entity()], today, NOW)[0].skipped, "limite diário atingido");
  // falhas não contam para o limite nem para a carência
  const failed = [{ entityExternalId: "c1", createdAt: "2026-10-22T10:00:00Z", status: "failed" }];
  assert.equal(decide(rule(), [entity()], failed, NOW)[0].skipped, null);
});

test("decide: orçamento sobe/desce pela porcentagem; compartilhado ou sem orçamento não mexe", () => {
  const up = rule({ metric: "roas", operator: "above", value: 1.5, action: "increase_budget", actionPercent: 20 });
  const [d] = decide(up, [entity()], [], NOW);
  assert.equal(d.action, "increase_budget");
  assert.equal(d.newBudget, 120);
  assert.equal(decide(up, [entity({ budgetShared: true })], [], NOW)[0].skipped, "orçamento compartilhado");
  assert.equal(decide(up, [entity({ dailyBudget: null })], [], NOW)[0].skipped, "campanha sem orçamento diário próprio");
  assert.equal(nextBudget(100, "decrease_budget", 30), 70);
  assert.equal(nextBudget(1.2, "decrease_budget", 90), 1); // nunca abaixo de R$ 1
  assert.equal(nextBudget(33.33, "increase_budget", 10), 36.66);
});

test("decide: ativar só campanha pausada; avisar não muda nada na conta", () => {
  const activate = rule({ metric: "roas", operator: "above", value: 1, action: "activate" });
  assert.equal(decide(activate, [entity()], [], NOW)[0].skipped, "já está ativa");
  assert.equal(decide(activate, [entity({ status: "PAUSED" })], [], NOW)[0].skipped, null);
  const notify = rule({ action: "notify" });
  assert.equal(decide(notify, [entity({ status: "PAUSED" })], [], NOW)[0].skipped, null);
});
