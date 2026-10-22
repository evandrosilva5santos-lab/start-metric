// Rodar de apps/dashboard: node --test scripts/reports-engine.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";

// Os módulos do app usam imports relativos sem extensão (estilo bundler); o Node exige extensão.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const { FULL_VARIABLE_CATALOG, VARIABLE_BY_SLUG, reportPickerVariables } = await import("../src/lib/reports/engine/catalog.ts");
const { renderTemplate } = await import("../src/lib/reports/engine/render.ts");
const { REPORT_PRESETS, ALERT_PRESETS, LEAD_PRESETS } = await import("../src/lib/reports/engine/presets.ts");
const { aggregateDailyMetrics, aggregateGoogleRows, totalMetrics, primaryResult, mergeMetrics, normalizeActionType, toFiniteNumber } = await import(
  "../src/lib/reports/engine/metrics.ts"
);
const { mapAccountInsightRow, mapCreativeRows, describeGraphError } = await import("../src/lib/reports/engine/insights-map.ts");

const plain = (s) => s.replace(/ /g, " ");
// 16/10/2026 12:30 UTC = 09:30 em São Paulo
const MORNING_SP = new Date("2026-10-16T12:30:00Z");

test("catálogo tem slugs únicos e cobre conversões geradas por action_type", () => {
  const slugs = FULL_VARIABLE_CATALOG.map((v) => v.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  assert.equal(slugs.length, 247);
  assert.ok(VARIABLE_BY_SLUG.has("meta_actions.purchase"));
  assert.ok(VARIABLE_BY_SLUG.has("meta_cost_per_action.lead"));
  assert.ok(VARIABLE_BY_SLUG.has("lead_name"));
});

// Catálogo público do Metrifiquei (v2.metrifiquei.com.br/app/variables, out/2026), canal Google.
// Saldo da conta fica de fora: a API do Google Ads não informa saldo de conta pré-paga.
const METRIFIQUEI_GOOGLE = [
  "google_clicks", "google_cpc", "google_cpm", "google_ctr", "google_spend", "google_impressions",
  "google_search_impression_share", "google_content_budget_lost_impression_share",
  "google_search_budget_lost_impression_share", "google_search_rank_lost_impression_share",
  "google_quality_score", "google_top_impression_percentage", "google_absolute_top_impression_percentage",
  "google_conversions", "google_roas", "google_all_roas", "google_conversions_from_interactions_rate",
  "google_all_conversions_from_interactions_rate", "google_all_conversions", "google_conversions_value",
  "google_all_conversions_value", "google_cost_per_conversion", "google_cost_per_all_conversions",
  "google_trueview_average_cpv", "google_video_trueview_view_rate", "google_video_trueview_views",
  "google_campaign_id", "google_ad_id", "google_adset_id", "google_campaign_name", "google_account_name",
  "google_ad_name", "google_adset_name", "google_currency", "google_all_keywords_simple",
  "google_all_keywords_ranking", "google_top_1_keywords_ranking", "google_top_3_keywords_ranking",
  "google_top_5_keywords_ranking",
];

const METRIFIQUEI_META_EXTRA = [
  "meta_campaign_id", "meta_adset_id", "meta_ad_id", "meta_objective", "meta_daily_budget", "meta_spend_cap",
  "meta_result_type", "meta_result_value", "meta_conv", "meta_all_creatives_simple",
];

// Variáveis "(total)": somam ou escolhem entre os canais do cliente; não pertencem a um canal.
const TOTALS = [
  "spend", "impressions", "clicks", "reach", "roas", "cpc", "cpm", "ctr", "currency",
  "account_name", "campaign_name", "campaign_id", "adset_name", "adset_id", "ad_name", "ad_id",
];

const INSTAGRAM = [
  "instagram_gender_female_pct", "instagram_gender_male_pct", "instagram_gender_unknown_pct", "instagram_reach",
  "instagram_audience_age_gender", "instagram_comments", "instagram_shares", "instagram_accounts_engaged",
  "instagram_likes", "instagram_followers_gained", "instagram_impressions", "instagram_engagement",
  "instagram_media_count", "instagram_posts", "instagram_saves", "instagram_followers_count",
  "instagram_follows_count", "instagram_engagement_rate", "instagram_top_cities", "instagram_profile_views",
  "instagram_username", "instagram_post_id", "instagram_post_caption",
];

test("catálogo cobre o Google Ads e os extras da Meta do Metrifiquei", () => {
  for (const slug of METRIFIQUEI_GOOGLE) {
    assert.equal(VARIABLE_BY_SLUG.get(slug)?.channel, "google", slug);
  }
  for (const slug of METRIFIQUEI_META_EXTRA) {
    assert.equal(VARIABLE_BY_SLUG.get(slug)?.channel, "meta", slug);
  }
});

test("valor de conversão do Google usa o mesmo nome do dado sincronizado", () => {
  assert.ok(VARIABLE_BY_SLUG.has("google_conversions_value"));
  assert.equal(VARIABLE_BY_SLUG.has("google_conversion_value"), false);
});

test("variáveis totais não pertencem a um canal", () => {
  for (const slug of TOTALS) {
    const def = VARIABLE_BY_SLUG.get(slug);
    assert.ok(def, slug);
    assert.equal(def.channel, undefined, slug);
  }
});

test("Instagram fica no catálogo como 'em breve' até a conexão existir", () => {
  for (const slug of INSTAGRAM) {
    const def = VARIABLE_BY_SLUG.get(slug);
    assert.equal(def?.channel, "instagram", slug);
    assert.equal(def.availability, "soon", slug);
  }
});

test("seletor de relatório oferece Google e totais, esconde 'em breve', alerta e lead", () => {
  const offered = new Set(reportPickerVariables().map((v) => v.slug));
  for (const slug of ["google_spend", "google_conversions_value", "spend", "account_name", "meta_spend"]) {
    assert.ok(offered.has(slug), slug);
  }
  for (const slug of ["instagram_reach", "current_value", "lead_name"]) {
    assert.equal(offered.has(slug), false, slug);
  }
});

test("preview usa o valor de exemplo; live nunca usa e lista o que faltou", () => {
  const tpl = "Investido: {{meta_spend}} | Alcance: {{meta_reach}}";
  const preview = renderTemplate(tpl, { now: MORNING_SP }, "preview");
  assert.equal(plain(preview.text), "Investido: R$ 1.624,30 | Alcance: 42.850");
  assert.deepEqual(preview.missing, []);

  const live = renderTemplate(tpl, { now: MORNING_SP, metrics: { meta_spend: 10 } }, "live");
  assert.equal(plain(live.text), "Investido: R$ 10,00 | Alcance: —");
  assert.deepEqual(live.missing, ["meta_reach"]);
});

test("live sem criativos não inventa ranking", () => {
  const live = renderTemplate("{{meta_top_3_creatives_ranking}}", { now: MORNING_SP }, "live");
  assert.equal(live.text, "—");
  assert.deepEqual(live.missing, ["meta_top_3_creatives_ranking"]);

  const preview = renderTemplate("{{meta_top_3_creatives_ranking}}", { now: MORNING_SP }, "preview");
  assert.match(preview.text, /🥇 1\./);
});

test("ranking com criativos reais respeita o limite", () => {
  const creatives = [1, 2, 3, 4].map((n) => ({ name: `Ad ${n}`, results: 10 * n, cpa: 5, ctr: 1.5, url: `https://x/${n}` }));
  const { text } = renderTemplate("{{meta_top_3_creatives_ranking}}", { now: MORNING_SP, creatives }, "live");
  assert.match(text, /Ad 3/);
  assert.doesNotMatch(text, /Ad 4/);
});

test("formata moeda, percentual e número em pt-BR, inclusive strings numéricas da Meta API", () => {
  const { text } = renderTemplate(
    "{{meta_spend}} {{meta_ctr}} {{meta_impressions}} {{meta_roas}}",
    { now: MORNING_SP, metrics: { meta_spend: "1624.3", meta_ctr: 1.8456, meta_impressions: 89200, meta_roas: 4.8234 } },
    "live",
  );
  assert.equal(plain(text), "R$ 1.624,30 1,85% 89.200 4,82");
});

test("saudação e hora seguem o fuso de São Paulo, não o do servidor", () => {
  const { text } = renderTemplate("{{greeting}} {{current_hour}}", { now: MORNING_SP }, "live");
  assert.equal(text, "Bom dia 09:30");
});

test("datas relativas resolvem na virada de mês no fuso local", () => {
  // 01/10 02:00 UTC ainda é 30/09 23:00 em São Paulo
  const now = new Date("2026-10-01T02:00:00Z");
  const { text, missing } = renderTemplate(
    "{{current_day}} {{current_month}} {{current_year}} {{yesterday}} {{previous_month}}",
    { now },
    "live",
  );
  assert.equal(text, "30 Setembro 2026 29/09/2026 Agosto");
  assert.deepEqual(missing, []);
});

test("dados do contexto preenchem variáveis universais; sem contexto, live marca como faltante", () => {
  const ctx = { now: MORNING_SP, clientName: "Loja X", startDate: "01/10/2026", endDate: "15/10/2026" };
  assert.equal(renderTemplate("{{client_name}} {{start_date}} a {{end_date}}", ctx, "live").text, "Loja X 01/10/2026 a 15/10/2026");

  const live = renderTemplate("{{client_name}} {{client_dashboard_url}}", { now: MORNING_SP }, "live");
  assert.equal(live.text, "— —");
  assert.deepEqual(live.missing, ["client_name", "client_dashboard_url"]);
});

test("modo demonstração mascara números sem esconder textos", () => {
  const { text } = renderTemplate(
    "{{client_name}} {{meta_spend}} {{meta_ctr}} {{meta_clicks}}",
    { now: MORNING_SP, clientName: "Loja X", metrics: { meta_spend: 10, meta_ctr: 1, meta_clicks: 5 }, maskRealValues: true },
    "live",
  );
  assert.equal(text, "Loja X R$ ••••• ••,•% •••••");
});

test("slug desconhecido vira — e é reportado mesmo no preview", () => {
  const r = renderTemplate("{{ meta_spned }}", { now: MORNING_SP }, "preview");
  assert.equal(r.text, "—");
  assert.deepEqual(r.missing, ["meta_spned"]);
});

test("todo slug usado nos presets existe no catálogo", () => {
  for (const preset of [...REPORT_PRESETS, ...ALERT_PRESETS, ...LEAD_PRESETS]) {
    for (const [, slug] of preset.content.matchAll(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g)) {
      assert.ok(VARIABLE_BY_SLUG.has(slug), `${preset.id} usa {{${slug}}}, que não está no catálogo`);
    }
  }
});

test("preset de alerta não duplica símbolo de moeda", () => {
  const preset = ALERT_PRESETS.find((p) => p.conditionType === "balance_below");
  const { text } = renderTemplate(
    preset.content,
    { now: MORNING_SP, texts: { account_name: "BM 1", current_value: "R$ 52,40", target_value: "R$ 100,00" } },
    "live",
  );
  assert.doesNotMatch(text, /R\$ R\$|,00,00/);
  assert.match(text, /R\$ 100,00/);
});

const close = (actual, expected, msg) => assert.ok(Math.abs(actual - expected) < 1e-9, `${msg ?? ""} esperado ${expected}, veio ${actual}`);

test("métricas: taxas saem dos totais, nunca da média por linha", () => {
  const m = aggregateDailyMetrics([
    { spend: 100, impressions: 1000, clicks: 100, conversions: 5, revenue_attributed: 0 },
    { spend: 50, impressions: 9000, clicks: 9, conversions: 1, revenue_attributed: 0 },
  ]);
  assert.equal(m.meta_spend, 150);
  assert.equal(m.meta_impressions, 10000);
  assert.equal(m.meta_clicks, 109);
  close(m.meta_ctr, 1.09, "CTR");
  close(m.ctr, 1.09, "ctr calculado");
  close(m.meta_cpc, 150 / 109, "CPC");
  close(m.cpc, 150 / 109, "cpc calculado");
  close(m.meta_cpm, 15, "CPM");
  close(m.cpm, 15, "cpm calculado");
  close(m.conversion_rate, (6 / 109) * 100, "taxa de conversão");
});

test("métricas: aceita numeric do Postgres como string e ignora lixo", () => {
  assert.equal(toFiniteNumber("12.5"), 12.5);
  assert.equal(toFiniteNumber(" "), null);
  assert.equal(toFiniteNumber("abc"), null);
  assert.equal(toFiniteNumber(null), null);
  assert.equal(toFiniteNumber(Number.NaN), null);

  const m = aggregateDailyMetrics([
    { spend: "10.50", impressions: "1000", clicks: "20", conversions: null, revenue_attributed: "31.5" },
    { spend: "abc", impressions: null, clicks: undefined, conversions: null, revenue_attributed: null },
  ]);
  assert.equal(m.meta_spend, 10.5);
  assert.equal(m.meta_impressions, 1000);
  assert.equal(m.meta_clicks, 20);
  close(m.meta_roas, 3);
  assert.equal("conversion_rate" in m, false);
});

test("métricas: ROAS é receita total / investimento total, sem peso pelo nome da campanha", () => {
  const m = aggregateDailyMetrics([
    { campaign_name: "A", spend: 100, impressions: 1, clicks: 1, conversions: 1, revenue_attributed: 500 },
    { campaign_name: "Campanha com nome bem longo", spend: 300, impressions: 1, clicks: 1, conversions: 1, revenue_attributed: 300 },
  ]);
  close(m.meta_roas, 2);
});

test("métricas: soma conversões por action_type e calcula custo por ação", () => {
  const m = aggregateDailyMetrics([
    { spend: 60, impressions: 100, clicks: 10, conversions: 2, revenue_attributed: 200, actions: { purchase: 2, lead: 0 }, action_values: { purchase: 200 } },
    { spend: "40", impressions: 100, clicks: 10, conversions: 3, revenue_attributed: 150, actions: { purchase: "3", "offsite_conversion.fb_pixel_purchase": 4 }, action_values: { purchase: "150.5" } },
    { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue_attributed: 0, actions: null, action_values: null },
  ]);
  assert.equal(m["meta_actions.purchase"], 5);
  assert.equal(m["meta_action_values.purchase"], 350.5);
  close(m["meta_cost_per_action.purchase"], 20);
  assert.equal(m["meta_actions.fb_pixel_purchase"], 4);
  close(m["meta_cost_per_action.fb_pixel_purchase"], 25);
  assert.equal(m["meta_actions.lead"], 0);
  assert.equal("meta_cost_per_action.lead" in m, false);
});

test("métricas: action_type da Meta vira o slug do catálogo", () => {
  assert.equal(normalizeActionType("purchase"), "purchase");
  assert.equal(normalizeActionType("offsite_conversion.fb_pixel_lead"), "fb_pixel_lead");
  assert.equal(normalizeActionType("onsite_conversion.messaging_first_reply"), "onsite_conversion_messaging_first_reply");
  for (const slug of ["meta_actions.fb_pixel_lead", "meta_actions.onsite_conversion_messaging_first_reply"]) {
    assert.ok(VARIABLE_BY_SLUG.has(slug), slug);
  }
});

test("métricas: sem dado não vira zero", () => {
  assert.deepEqual(aggregateDailyMetrics([]), {});

  const m = aggregateDailyMetrics([{ spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue_attributed: 0 }]);
  assert.equal(m.meta_spend, 0);
  for (const slug of ["meta_cpc", "cpc", "meta_cpm", "cpm", "meta_ctr", "ctr", "meta_roas", "conversion_rate"]) {
    assert.equal(slug in m, false, `${slug} deveria estar ausente`);
  }

  const noRevenue = aggregateDailyMetrics([{ spend: 10, impressions: 10, clicks: 1, conversions: null, revenue_attributed: null }]);
  assert.equal("meta_roas" in noRevenue, false);
});

test("métricas: Insights ao vivo sobrescreve e completa o banco sem mutar as entradas", () => {
  const db = Object.freeze({ meta_spend: 100, meta_reach: 1 });
  const live = Object.freeze({ meta_reach: 4200, meta_frequency: 2.1, meta_spend: Number.NaN, "meta_video_p25.video_view": undefined });
  const merged = mergeMetrics(db, live, null, undefined);
  assert.deepEqual(merged, { meta_spend: 100, meta_reach: 4200, meta_frequency: 2.1 });
  assert.deepEqual(db, { meta_spend: 100, meta_reach: 1 });
});

test("métricas do banco alimentam o renderer: ausente vira —", () => {
  const metrics = aggregateDailyMetrics([{ spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue_attributed: 0, actions: { purchase: 0 } }]);
  const r = renderTemplate("{{meta_spend}} {{meta_cpc}} {{meta_actions.purchase}} {{meta_cost_per_action.purchase}}", { now: MORNING_SP, metrics }, "live");
  assert.equal(plain(r.text), "R$ 0,00 — 0 —");
  assert.deepEqual(r.missing, ["meta_cpc", "meta_cost_per_action.purchase"]);
});

test("Insights: alcance, frequência e vídeo viram slugs do catálogo", () => {
  const m = mapAccountInsightRow({
    reach: "4200",
    frequency: "2.0833",
    video_play_actions: [{ action_type: "video_view", value: "1800" }],
    video_thruplay_watched_actions: [{ action_type: "video_view", value: "925" }],
    video_p25_watched_actions: [{ action_type: "video_view", value: "1420" }],
    video_p50_watched_actions: [{ action_type: "video_view", value: "810" }],
    video_p75_watched_actions: [{ action_type: "video_view", value: "489" }],
    video_p95_watched_actions: [{ action_type: "video_view", value: "284" }],
    video_p100_watched_actions: [{ action_type: "video_view", value: "212" }],
    video_avg_time_watched_actions: [{ action_type: "video_view", value: "8.4" }],
  });
  assert.deepEqual(m, {
    meta_reach: 4200,
    meta_frequency: 2.0833,
    "meta_video_play.video_view": 1800,
    "meta_video_thruplay.video_view": 925,
    "meta_video_p25.video_view": 1420,
    "meta_video_p50.video_view": 810,
    "meta_video_p75.video_view": 489,
    "meta_video_p95.video_view": 284,
    "meta_video_p100.video_view": 212,
    "meta_video_avg_time.video_view": "8,4 seg",
  });
  for (const slug of Object.keys(m)) assert.ok(VARIABLE_BY_SLUG.has(slug), slug);
  assert.deepEqual(mapAccountInsightRow({ reach: "", video_play_actions: [] }), {});
  assert.deepEqual(mapAccountInsightRow(undefined), {});
});

test("Insights: ranking de criativos usa um só tipo de resultado, CPA e CTR reais", () => {
  const rows = [
    { ad_id: "1", ad_name: "Lead A", spend: "50", impressions: "1000", clicks: "20", actions: [{ action_type: "lead", value: "10" }] },
    { ad_id: "2", ad_name: "Compra B", spend: "90", impressions: "2000", clicks: "30", actions: [{ action_type: "purchase", value: "3" }, { action_type: "lead", value: "1" }] },
    { ad_id: "3", ad_name: "Compra C", spend: "40", impressions: "500", clicks: "10", actions: [{ action_type: "purchase", value: "4" }] },
    { ad_id: "4", ad_name: "Sem resultado", spend: "70", impressions: "900", clicks: "9", actions: [] },
  ];
  const ranked = mapCreativeRows(rows, { limit: 5, urls: { "3": "https://instagram.com/p/c" } });
  assert.deepEqual(ranked.map((c) => c.name), ["Compra C", "Compra B"]);
  assert.deepEqual(ranked[0], { name: "Compra C", results: 4, cpa: 10, ctr: 2, url: "https://instagram.com/p/c" });
  close(ranked[1].cpa, 30);
  close(ranked[1].ctr, 1.5);
  assert.equal("url" in ranked[1], false);

  assert.deepEqual(mapCreativeRows(rows, { limit: 1, resultActionTypes: ["lead"] }).map((c) => c.name), ["Lead A"]);
  assert.deepEqual(mapCreativeRows([], { limit: 3 }), []);
});

test("Insights: erro da Graph API vira mensagem legível", () => {
  assert.match(describeGraphError({ code: 190, message: "Error validating access token" }), /expirou/i);
  assert.match(describeGraphError({ code: 17, message: "User request limit reached" }), /limite/i);
  assert.match(describeGraphError({ code: 100, message: "Invalid parameter" }), /\(100\).*Invalid parameter/);
});

// ---------------------------------------------------------------- Google e totais

test("Google: micros viram reais e as taxas saem das somas do período", () => {
  const m = aggregateGoogleRows([
    { cost_micros: "150000000", impressions: "10000", clicks: "400", conversions: "20", conversions_value: "900" },
    { cost_micros: 50000000, impressions: 5000, clicks: 100, conversions: 5, conversions_value: 100 },
  ]);
  close(m.google_spend, 200);
  assert.equal(m.google_impressions, 15000);
  assert.equal(m.google_clicks, 500);
  assert.equal(m.google_conversions, 25);
  close(m.google_conversions_value, 1000);
  close(m.google_ctr, (500 / 15000) * 100);
  close(m.google_cpc, 0.4);
  close(m.google_cpm, (200 / 15000) * 1000);
  close(m.google_cost_per_conversion, 8);
  close(m.google_roas, 5);
  for (const slug of Object.keys(m)) assert.ok(VARIABLE_BY_SLUG.has(slug), slug);
});

test("Google: sem clique ou conversão não inventa taxa", () => {
  const m = aggregateGoogleRows([{ cost_micros: 0, impressions: 0, clicks: 0, conversions: 0, conversions_value: 0 }]);
  assert.equal(m.google_spend, 0);
  assert.equal("google_ctr" in m, false);
  assert.equal("google_cpc" in m, false);
  assert.equal("google_cost_per_conversion" in m, false);
  assert.deepEqual(aggregateGoogleRows([]), {});
});

test("Totais somam Meta + Google e recalculam CTR, CPC, CPM e ROAS", () => {
  const meta = aggregateDailyMetrics([{ spend: 100, impressions: 10000, clicks: 200, conversions: 4, revenue_attributed: 500 }]);
  const google = aggregateGoogleRows([{ cost_micros: 100000000, impressions: 5000, clicks: 300, conversions: 10, conversions_value: 300 }]);
  const t = totalMetrics({ ...meta, ...google, meta_reach: 4200 });
  close(t.spend, 200);
  assert.equal(t.impressions, 15000);
  assert.equal(t.clicks, 500);
  close(t.ctr, (500 / 15000) * 100);
  close(t.cpc, 0.4);
  close(t.cpm, (200 / 15000) * 1000);
  close(t.roas, (500 + 300) / 200);
  assert.equal(t.reach, 4200);
});

test("Totais só com Meta repetem os números da Meta", () => {
  const meta = aggregateDailyMetrics([{ spend: 100, impressions: 10000, clicks: 200, conversions: 4, revenue_attributed: 500 }]);
  const t = totalMetrics(meta);
  close(t.spend, 100);
  close(t.ctr, meta.meta_ctr);
  close(t.cpc, meta.meta_cpc);
  close(t.roas, meta.meta_roas);
  assert.deepEqual(totalMetrics({}), {});
});

test("Meta: conversões do período e resultado principal pela prioridade", () => {
  const m = aggregateDailyMetrics([
    { spend: 10, impressions: 100, clicks: 5, conversions: 3, revenue_attributed: 0, actions: { lead: 7, "offsite_conversion.fb_pixel_purchase": 2 } },
  ]);
  assert.equal(m.meta_conv, 3);
  assert.deepEqual(primaryResult(m, ["purchase", "offsite_conversion.fb_pixel_purchase", "lead"]), { type: "fb_pixel_purchase", value: 2 });
  assert.deepEqual(primaryResult(m, ["lead"]), { type: "lead", value: 7 });
  assert.equal(primaryResult(m, ["purchase"]), null);
});

test("ranking simples de criativos mostra só posição e nome", () => {
  const creatives = [
    { name: "Ad 1", results: 3, cpa: 10, ctr: 2 },
    { name: "Ad 2", results: 2, cpa: 12, ctr: 1 },
  ];
  const { text } = renderTemplate("{{meta_all_creatives_simple}}", { creatives }, "live");
  assert.equal(text, "🥇 1. Ad 1\n🥈 2. Ad 2");
});
