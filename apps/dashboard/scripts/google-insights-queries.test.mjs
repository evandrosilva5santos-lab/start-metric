// Rodar de apps/dashboard: node --test scripts/google-insights-queries.test.mjs
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

const q = await import("../src/lib/google-ads/insights-queries.ts");

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `esperado ${b}, veio ${a}`);
const RANGE = { from: "2026-10-01", to: "2026-10-22" };

test("consultas: usam a view certa, o período e o filtro de campanha", () => {
  assert.match(q.keywordsDetailQuery(RANGE), /FROM keyword_view WHERE segments\.date BETWEEN '2026-10-01' AND '2026-10-22'/);
  assert.match(q.searchTermsQuery(RANGE), /FROM search_term_view/);
  assert.match(q.deviceQuery(RANGE), /segments\.device/);
  assert.match(q.genderQuery(RANGE), /FROM gender_view/);
  assert.match(q.ageQuery(RANGE), /FROM age_range_view/);
  assert.match(q.keywordsDetailQuery({ ...RANGE, campaignId: "123" }), /campaign\.id = 123/);
  assert.doesNotMatch(q.keywordsDetailQuery(RANGE), /campaign\.id =/);
});

test("consultas: rejeitam id de campanha e datas que não sejam o formato esperado (sem injeção de GAQL)", () => {
  assert.throws(() => q.keywordsDetailQuery({ ...RANGE, campaignId: "1 OR 1=1" }));
  assert.throws(() => q.deviceQuery({ from: "2026-10-01'; --", to: "2026-10-22" }));
  assert.throws(() => q.geoNamesQuery(["1001773", "12;DROP"]));
});

test("consultas: limitam as linhas e ordenam por custo", () => {
  assert.match(q.searchTermsQuery(RANGE), /ORDER BY metrics\.cost_micros DESC LIMIT \d+/);
  assert.match(q.keywordsDetailQuery(RANGE), /ORDER BY metrics\.cost_micros DESC LIMIT \d+/);
});

test("localidade: o nível escolhe o campo e o tipo escolhe presença ou interesse", () => {
  const city = q.geoQuery({ ...RANGE, level: "city", locationType: "presence" });
  assert.match(city, /segments\.geo_target_city/);
  assert.match(city, /geographic_view\.location_type = 'LOCATION_OF_PRESENCE'/);
  const region = q.geoQuery({ ...RANGE, level: "region", locationType: "interest" });
  assert.match(region, /segments\.geo_target_region/);
  assert.match(region, /AREA_OF_INTEREST/);
  assert.match(q.geoQuery({ ...RANGE, level: "country", locationType: "presence" }), /geographic_view\.country_criterion_id/);
});

test("visibilidade: consulta sem segments.date no SELECT (parcela não se soma por dia)", () => {
  const query = q.visibilityQuery(RANGE);
  const select = query.slice(0, query.indexOf("FROM"));
  assert.doesNotMatch(select, /segments\.date/);
  assert.match(query, /search_impression_share/);
});

test("mapKeywordRow: converte int64 em texto, calcula indicadores e guarda status e índice de qualidade", () => {
  const row = q.mapKeywordRow({
    campaign: { id: "1", name: "Pesquisa Serviços" },
    adGroup: { id: "10", name: "Grupo A" },
    adGroupCriterion: { keyword: { text: "janela", matchType: "PHRASE" }, status: "ENABLED", qualityInfo: { qualityScore: 7 } },
    metrics: { impressions: "1000", clicks: "50", costMicros: "25000000", conversions: 2, conversionsValue: 300 },
  });
  assert.equal(row.keyword, "janela");
  assert.equal(row.matchType, "PHRASE");
  assert.equal(row.campaign, "Pesquisa Serviços");
  assert.equal(row.adGroup, "Grupo A");
  assert.equal(row.status, "ENABLED");
  assert.equal(row.qualityScore, 7);
  close(row.spend, 25);
  close(row.ctr, 5);
  close(row.cpa, 12.5);
  close(row.roas, 12);
});

test("mapKeywordRow: sem índice de qualidade devolve null e sem conversão o CPA é null", () => {
  const row = q.mapKeywordRow({
    campaign: { id: "1", name: "C" },
    adGroup: { id: "10", name: "G" },
    adGroupCriterion: { keyword: { text: "x", matchType: "EXACT" }, status: "PAUSED" },
    metrics: { impressions: "10", clicks: "1", costMicros: "1000000" },
  });
  assert.equal(row.qualityScore, null);
  assert.equal(row.cpa, null);
  close(row.spend, 1);
});

test("mapSearchTermRow: mascara e-mail e telefone no termo", () => {
  const row = q.mapSearchTermRow({
    searchTermView: { searchTerm: "orçamento maria@x.com 51 99999-9999", status: "NONE" },
    segments: { keyword: { info: { text: "janela", matchType: "BROAD" } } },
    campaign: { id: "1", name: "C" },
    adGroup: { id: "10", name: "G" },
    metrics: { impressions: "5", clicks: "1", costMicros: "2000000", conversions: 0 },
  });
  assert.equal(row.term, "orçamento [e-mail oculto] [número oculto]");
  assert.equal(row.keyword, "janela");
  assert.equal(row.matchType, "BROAD");
});

test("groupSegments: soma linhas do mesmo segmento (várias campanhas) e recalcula as taxas", () => {
  const rows = [
    { segments: { device: "MOBILE" }, metrics: { impressions: "1000", clicks: "100", costMicros: "50000000", conversions: 5 } },
    { segments: { device: "MOBILE" }, metrics: { impressions: "1000", clicks: "100", costMicros: "50000000", conversions: 0 } },
    { segments: { device: "DESKTOP" }, metrics: { impressions: "500", clicks: "10", costMicros: "10000000", conversions: 1 } },
  ];
  const grouped = q.groupSegments(rows, (r) => r.segments.device, "device");
  const mobile = grouped.find((g) => g.device === "MOBILE");
  assert.equal(grouped.length, 2);
  assert.equal(mobile.impressions, 2000);
  close(mobile.spend, 100);
  close(mobile.ctr, 10);
  close(mobile.cpa, 20);
  close(mobile.conversionRate, 2.5);
});

test("segmentKey: sexo, idade e local saem do campo certo da resposta", () => {
  assert.equal(q.genderKey({ adGroupCriterion: { gender: { type: "FEMALE" } } }), "FEMALE");
  assert.equal(q.ageKey({ adGroupCriterion: { ageRange: { type: "AGE_RANGE_25_34" } } }), "AGE_RANGE_25_34");
  assert.equal(q.geoKey({ segments: { geoTargetCity: "geoTargetConstants/1001773" } }, "city"), "1001773");
  assert.equal(q.geoKey({ geographicView: { countryCriterionId: "2076" } }, "country"), "2076");
  assert.equal(q.geoKey({ segments: {} }, "city"), null);
});

test("applyGeoNames: usa o nome canônico e, sem nome, um rótulo honesto com o id", () => {
  const rows = [{ geoId: "1001773", impressions: 1 }, { geoId: "999", impressions: 1 }];
  const named = q.applyGeoNames(rows, new Map([["1001773", "Porto Alegre,State of Rio Grande do Sul,Brazil"]]));
  assert.equal(named[0].location, "Porto Alegre,State of Rio Grande do Sul,Brazil");
  assert.equal(named[1].location, "Local 999");
});

test("mapVisibilityRow: só Pesquisa tem parcela de impressões; os demais tipos ficam 'não aplicável'", () => {
  const search = q.mapVisibilityRow({
    campaign: { id: "1", name: "S", advertisingChannelType: "SEARCH" },
    metrics: { impressions: "1000", costMicros: "1000000", searchImpressionShare: 0.42, searchBudgetLostImpressionShare: 0.3, searchRankLostImpressionShare: 0.28, topImpressionPercentage: 0.6, absoluteTopImpressionPercentage: 0.2 },
  });
  assert.equal(search.shareApplicable, true);
  close(search.searchImpressionShare, 0.42);
  const display = q.mapVisibilityRow({
    campaign: { id: "2", name: "D", advertisingChannelType: "DISPLAY" },
    metrics: { impressions: "1000", costMicros: "1000000" },
  });
  assert.equal(display.shareApplicable, false);
  const missing = q.mapVisibilityRow({
    campaign: { id: "3", name: "S2", advertisingChannelType: "SEARCH" },
    metrics: { impressions: "10", costMicros: "0" },
  });
  assert.equal(missing.shareApplicable, true);
  assert.equal(missing.searchImpressionShare, null);
});
