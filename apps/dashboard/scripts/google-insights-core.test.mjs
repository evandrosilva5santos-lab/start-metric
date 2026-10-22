// Rodar de apps/dashboard: node --test scripts/google-insights-core.test.mjs
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

const { deriveMetrics, sortRows, filterRows, toCsv, cellState, maskPii } = await import("../src/lib/google-ads/insights-core.ts");

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `esperado ${b}, veio ${a}`);

test("deriveMetrics: calcula CTR, CPC, CPA, taxa de conversão e ROAS", () => {
  const m = deriveMetrics({ costMicros: 100_000_000, impressions: 10000, clicks: 200, conversions: 5, conversionsValue: 400 });
  close(m.spend, 100);
  close(m.ctr, 2);
  close(m.cpc, 0.5);
  close(m.cpa, 20);
  close(m.conversionRate, 2.5);
  close(m.roas, 4);
});

test("deriveMetrics: sem denominador devolve null (nunca zero inventado)", () => {
  const m = deriveMetrics({ costMicros: 50_000_000, impressions: 0, clicks: 0, conversions: 0, conversionsValue: 0 });
  assert.equal(m.ctr, null);
  assert.equal(m.cpc, null);
  assert.equal(m.cpa, null);
  assert.equal(m.conversionRate, null);
  close(m.spend, 50);
  close(m.roas, 0);
});

test("sortRows: ordena por métrica, nulos sempre por último nas duas direções", () => {
  const rows = [{ n: "a", cpa: 30 }, { n: "b", cpa: null }, { n: "c", cpa: 10 }];
  assert.deepEqual(sortRows(rows, "cpa", "asc").map((r) => r.n), ["c", "a", "b"]);
  assert.deepEqual(sortRows(rows, "cpa", "desc").map((r) => r.n), ["a", "c", "b"]);
  assert.deepEqual(rows.map((r) => r.n), ["a", "b", "c"], "não muta a lista original");
});

test("sortRows: texto em ordem alfabética sem diferenciar acento e caixa", () => {
  const rows = [{ n: "Água" }, { n: "casa" }, { n: "Bola" }];
  assert.deepEqual(sortRows(rows, "n", "asc").map((r) => r.n), ["Água", "Bola", "casa"]);
});

test("filterRows: busca sem diferenciar acento e caixa, em vários campos", () => {
  const rows = [
    { term: "Esquadria de alumínio", campaign: "Pesquisa Serviços" },
    { term: "janela", campaign: "Display" },
  ];
  assert.equal(filterRows(rows, "ALUMINIO", ["term", "campaign"]).length, 1);
  assert.equal(filterRows(rows, "display", ["term", "campaign"]).length, 1);
  assert.equal(filterRows(rows, "  ", ["term"]).length, 2, "busca vazia não filtra");
  assert.equal(filterRows(rows, "inexistente", ["term"]).length, 0);
});

test("toCsv: separador ; , decimal com vírgula, aspas escapadas e BOM", () => {
  const csv = toCsv(
    [
      { key: "term", label: "Termo" },
      { key: "spend", label: "Custo" },
    ],
    [{ term: 'casa "boa"; nova', spend: 12.5 }],
  );
  assert.ok(csv.startsWith("﻿"));
  const lines = csv.slice(1).split("\r\n");
  assert.equal(lines[0], "Termo;Custo");
  assert.equal(lines[1], '"casa ""boa""; nova";12,5');
});

test("toCsv: neutraliza fórmula de planilha (= + - @) em texto, mas não em número negativo", () => {
  const csv = toCsv([{ key: "t", label: "T" }, { key: "n", label: "N" }], [
    { t: '=HYPERLINK("http://x")', n: -3 },
    { t: "+55 11", n: 1 },
    { t: "@cmd", n: 2 },
  ]);
  const lines = csv.slice(1).split("\r\n");
  assert.ok(lines[1].startsWith("\"'=HYPERLINK"), lines[1]);
  assert.ok(lines[1].endsWith(";-3"));
  assert.ok(lines[2].startsWith("'+55 11"));
  assert.ok(lines[3].startsWith("'@cmd"));
});

test("toCsv: nulos viram vazio, não 'null' nem zero", () => {
  const csv = toCsv([{ key: "a", label: "A" }, { key: "b", label: "B" }], [{ a: null, b: undefined }]);
  assert.equal(csv.slice(1).split("\r\n")[1], ";");
});

test("maskPii: esconde e-mail, telefone e CPF digitados em termos de busca", () => {
  assert.equal(maskPii("contato joao@empresa.com.br orçamento"), "contato [e-mail oculto] orçamento");
  assert.equal(maskPii("whatsapp +55 (51) 99999-9999 janela"), "whatsapp [número oculto] janela");
  assert.equal(maskPii("cpf 123.456.789-09"), "cpf [número oculto]");
});

test("maskPii: preserva termos normais, anos e medidas curtas", () => {
  assert.equal(maskPii("esquadria de alumínio 2026"), "esquadria de alumínio 2026");
  assert.equal(maskPii("janela 120x150 preço"), "janela 120x150 preço");
  assert.equal(maskPii(""), "");
});

test("cellState: distingue valor, zero, não disponível e não aplicável", () => {
  assert.deepEqual(cellState(0, { applicable: true }), { kind: "value", value: 0 });
  assert.deepEqual(cellState(12, { applicable: true }), { kind: "value", value: 12 });
  assert.deepEqual(cellState(null, { applicable: true }), { kind: "unavailable" });
  assert.deepEqual(cellState(undefined, { applicable: true }), { kind: "unavailable" });
  assert.deepEqual(cellState(7, { applicable: false }), { kind: "not_applicable" });
  assert.deepEqual(cellState(null, { applicable: false }), { kind: "not_applicable" });
});
