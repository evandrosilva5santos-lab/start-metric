// Rodar de apps/dashboard: node --test scripts/meta-regras.test.mjs (Node 22.18+ remove os tipos do .ts)
// Os números vêm da conta real CA - Moving Festival, conferidos contra o Gerenciador.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contar, valorDaConversao, campoDeVideo, periodos, dataNoFuso, listaDeDias, diaDaSemana,
  metricas, variacao, tipoDoConjunto, tipoDaCampanha, situacao, aprendizado, deCentavos, estaCansado,
} from "../src/lib/meta/regras.ts";

const acoesMoving = [
  { action_type: "omni_purchase", value: "502" },
  { action_type: "offsite_conversion.fb_pixel_purchase", value: "259" },
  { action_type: "purchase", value: "259" },
  { action_type: "offline_conversion.purchase", value: "243" },
  { action_type: "initiate_checkout", value: "345" },
  { action_type: "omni_initiated_checkout", value: "345" },
];
const valoresMoving = [
  { action_type: "omni_purchase", value: "42884.5" },
  { action_type: "purchase", value: "28272.5" },
  { action_type: "offsite_conversion.fb_pixel_purchase", value: "28272.5" },
];

test("conta uma conversão só, pelo primeiro nome da prioridade", () => {
  assert.deepEqual(contar(acoesMoving, "compra"), { valor: 259, nome: "purchase" });
  assert.equal(contar(acoesMoving, "checkout").valor, 345);
  assert.deepEqual(contar([{ action_type: "omni_purchase", value: "7" }], "compra"), { valor: 7, nome: "omni_purchase" });
  assert.deepEqual(contar([], "lead"), { valor: 0, nome: null });
});

test("receita usa o mesmo nome da contagem (não o maior valor)", () => {
  const { nome } = contar(acoesMoving, "compra");
  assert.equal(valorDaConversao(valoresMoving, nome), 28272.5);
  assert.equal(valorDaConversao(valoresMoving, null), 0);
});

test("o dia é o da conta: 01:59 UTC ainda é o dia anterior em São Paulo", () => {
  const instante = new Date("2026-09-25T01:59:34Z");
  assert.equal(dataNoFuso("America/Sao_Paulo", instante), "2026-09-24");
  assert.equal(dataNoFuso("UTC", instante), "2026-09-25");
  const p = periodos("America/Sao_Paulo", "last_30d", instante);
  assert.deepEqual(p.atual, { since: "2026-08-25", until: "2026-09-23" });
  assert.deepEqual(p.anterior, { since: "2026-07-26", until: "2026-08-24" });
  assert.equal(listaDeDias(p.atual).length, 30);
});

test("períodos de 7 e 14 dias e mês têm o anterior do mesmo tamanho", () => {
  const instante = new Date("2026-09-25T01:59:34Z");
  const p14 = periodos("America/Sao_Paulo", "last_14d", instante);
  assert.deepEqual(p14.atual, { since: "2026-09-10", until: "2026-09-23" });
  assert.deepEqual(p14.anterior, { since: "2026-08-27", until: "2026-09-09" });
  const p7 = periodos("America/Sao_Paulo", "last_7d", instante);
  assert.equal(listaDeDias(p7.anterior).length, 7);
  assert.equal(p7.anterior.until, "2026-09-16");
  const pm = periodos("America/Sao_Paulo", "last_month", instante);
  assert.deepEqual(pm.atual, { since: "2026-08-01", until: "2026-08-31" });
  assert.deepEqual(pm.anterior, { since: "2026-07-01", until: "2026-07-31" });
  const pmar = periodos("America/Sao_Paulo", "this_month", new Date("2026-03-31T15:00:00Z"));
  assert.deepEqual(pmar.anterior, { since: "2026-02-01", until: "2026-02-28" });
});

test("dia da semana sai da data da conta", () => {
  assert.equal(diaDaSemana("2026-09-24"), 4); // quinta
  assert.equal(diaDaSemana("2026-09-27"), 0); // domingo
});

test("CTR, CPM e frequência a partir dos totais (conta Moving, 30 dias)", () => {
  const m = metricas({ gasto: 3345.64, impressoes: 492624, cliques: 7290, alcance: 100647 });
  assert.equal(m.cpm.toFixed(2), "6.79");
  assert.equal(m.ctr.toFixed(3), "1.480");
  assert.equal(m.cpc.toFixed(2), "0.46");
  assert.equal(m.frequencia.toFixed(2), "4.89");
  assert.deepEqual(metricas({ gasto: 0, impressoes: 0, cliques: 0 }), { ctr: 0, cpm: 0, cpc: 0, frequencia: 0 });
});

test("variação sem base não existe", () => {
  assert.equal(variacao(10, 0), null);
  assert.equal(variacao(110, 100)?.toFixed(1), "10.0");
});

test("resultado segue o que o conjunto otimiza", () => {
  assert.equal(tipoDoConjunto({ optimization_goal: "OFFSITE_CONVERSIONS", promoted_object: { custom_event_type: "PURCHASE" } }), "compra");
  assert.equal(tipoDoConjunto({ optimization_goal: "OFFSITE_CONVERSIONS", promoted_object: { custom_event_type: "LEAD" } }), "lead");
  assert.equal(tipoDoConjunto({ optimization_goal: "CONVERSATIONS", destination_type: "WHATSAPP" }), "conversa");
  assert.equal(tipoDoConjunto({ optimization_goal: "LEAD_GENERATION" }), "lead");
  assert.equal(tipoDoConjunto({ optimization_goal: "LINK_CLICKS" }), null);
  assert.equal(tipoDoConjunto({ optimization_goal: "PROFILE_VISIT", destination_type: "INSTAGRAM_PROFILE" }), null);
});

test("campanha de Vendas que otimiza pra conversa mostra conversas, não 0 compras", () => {
  const conjuntos = [
    { effective_status: "ACTIVE", optimization_goal: "CONVERSATIONS", destination_type: "WHATSAPP" },
    { effective_status: "PAUSED", optimization_goal: "OFFSITE_CONVERSIONS", promoted_object: { custom_event_type: "PURCHASE" } },
  ];
  assert.equal(tipoDaCampanha("OUTCOME_SALES", conjuntos), "conversa");
  assert.equal(tipoDaCampanha("OUTCOME_SALES", []), "compra");
  assert.equal(tipoDaCampanha("OUTCOME_AWARENESS", [{ effective_status: "ACTIVE", optimization_goal: "REACH" }]), null);
  assert.equal(tipoDaCampanha("OUTCOME_TRAFFIC", []), null);
});

test("ligada sem impressão = sem entrega; status vem da entidade", () => {
  assert.equal(situacao("ACTIVE", 0), "sem_entrega");
  assert.equal(situacao("ACTIVE", 10), "ativa");
  assert.equal(situacao("PAUSED", 500), "pausada");
  assert.equal(situacao("WITH_ISSUES", 0), "com_problema");
  assert.equal(situacao(undefined, 500), "encerrada");
});

test("aprendizado dos conjuntos ligados", () => {
  assert.equal(aprendizado([{ effective_status: "ACTIVE", learning_stage_info: { status: "FAIL" } }, { effective_status: "ACTIVE", learning_stage_info: { status: "SUCCESS" } }]), "limitado");
  assert.equal(aprendizado([{ effective_status: "ACTIVE", learning_stage_info: { status: "LEARNING" } }]), "aprendendo");
  assert.equal(aprendizado([{ effective_status: "PAUSED", learning_stage_info: { status: "FAIL" } }]), null);
});

test("orçamento vem em centavos", () => {
  assert.equal(deCentavos("1500", "BRL"), 15);
  assert.equal(deCentavos("1500", "JPY"), 1500);
  assert.equal(deCentavos("0", "BRL"), null);
});

test("cansado: CTR caiu >20% E CPM subiu >10% (Invasion no Envolvimento 14D)", () => {
  const anterior = { gasto: 76.51, impressoes: 10320, cliques: 199 };
  const atual = { gasto: 315.3, impressoes: 37994, cliques: 473 };
  assert.equal(estaCansado(atual, anterior), true);
  // Invasion somado em todos os conjuntos: CTR caiu 32,5% mas CPM subiu só 6,5%. Não é cansaço pela regra.
  assert.equal(estaCansado({ gasto: 733.13, impressoes: 86485, cliques: 1042 }, { gasto: 256.81, impressoes: 32272, cliques: 576 }), false);
  assert.equal(estaCansado({ gasto: 10, impressoes: 500, cliques: 1 }, { gasto: 5, impressoes: 500, cliques: 10 }), false);
});

test("campo de vídeo", () => {
  assert.equal(campoDeVideo([{ action_type: "video_view", value: "812" }]), 812);
  assert.equal(campoDeVideo(undefined), 0);
});
