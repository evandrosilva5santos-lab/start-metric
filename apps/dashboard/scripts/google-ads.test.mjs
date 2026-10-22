// Rodar de apps/dashboard: node --test scripts/google-ads.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createVerify } from "node:crypto";
import { registerHooks } from "node:module";

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith(".") && !/\.[cm]?[jt]s$/.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});

const gaql = await import("../src/lib/google-ads/gaql.ts");
const { buildServiceAccountAssertion, parseServiceAccount } = await import("../src/lib/google-ads/jwt.ts");

// ── Ids de cliente ──────────────────────────────────────────────────────────
test("id de cliente: normaliza com ou sem traços e formata para exibir", () => {
  assert.equal(gaql.normalizeCustomerId("720-574-9286"), "7205749286");
  assert.equal(gaql.normalizeCustomerId(" 7205749286 "), "7205749286");
  assert.equal(gaql.normalizeCustomerId("123"), null);
  assert.equal(gaql.normalizeCustomerId("act_123"), null);
  assert.equal(gaql.formatCustomerId("7205749286"), "720-574-9286");
});

// ── Consultas GAQL ──────────────────────────────────────────────────────────
test("consulta de métricas diárias usa o intervalo pedido e valida as datas", () => {
  const q = gaql.dailyMetricsQuery("2026-10-01", "2026-10-21");
  assert.match(q, /FROM campaign/);
  assert.match(q, /segments\.date BETWEEN '2026-10-01' AND '2026-10-21'/);
  assert.match(q, /metrics\.cost_micros/);
  assert.throws(() => gaql.dailyMetricsQuery("2026-10-01'; DROP", "2026-10-21"), /data inválida/);
});

test("consulta de contas lista o MCC e as contas filhas diretas", () => {
  const q = gaql.accountsQuery();
  assert.match(q, /FROM customer_client/);
  assert.match(q, /customer_client\.level <= 1/);
});

// ── Leitura das respostas REST (int64 como texto; zeros podem faltar) ──────
test("conta filha vira registro de conta; o próprio MCC é marcado como gerenciador", () => {
  const rows = [
    { customerClient: { id: "7205749286", descriptiveName: "ADM PRINCIPAL", currencyCode: "BRL", timeZone: "America/Sao_Paulo", manager: true, level: "0", status: "ENABLED" } },
    { customerClient: { id: "3418489444", descriptiveName: "Arroba Banda Larga", currencyCode: "BRL", timeZone: "America/Sao_Paulo", level: "1", status: "ENABLED" } },
    { customerClient: { id: "1973021190", descriptiveName: "", currencyCode: "BRL", timeZone: "America/Sao_Paulo", level: "1", status: "CANCELED" } },
  ];
  const accounts = rows.map(gaql.mapCustomerClient);
  assert.deepEqual(accounts[0], { customerId: "7205749286", name: "ADM PRINCIPAL", currency: "BRL", timeZone: "America/Sao_Paulo", manager: true, status: "ENABLED", level: 0 });
  assert.equal(accounts[1].manager, false);
  assert.equal(accounts[2].name, "Conta 197-302-1190");
});

test("campanha traz tipo, status e orçamento diário em micros", () => {
  const c = gaql.mapCampaign({
    campaign: { id: "22001", name: "Search | Marca", status: "ENABLED", advertisingChannelType: "SEARCH", biddingStrategyType: "MAXIMIZE_CONVERSIONS" },
    campaignBudget: { amountMicros: "50000000", period: "DAILY" },
  });
  assert.deepEqual(c, { campaignId: "22001", name: "Search | Marca", status: "ENABLED", channelType: "SEARCH", channelSubType: null, biddingStrategyType: "MAXIMIZE_CONVERSIONS", budgetMicros: 50000000, budgetPeriod: "DAILY" });
});

test("métrica diária: campos ausentes valem zero", () => {
  const m = gaql.mapDailyMetric({ campaign: { id: "22001" }, segments: { date: "2026-10-13" }, metrics: { costMicros: "12340000", impressions: "1000", clicks: "40", conversions: 2.5 } });
  assert.deepEqual(m, { campaignId: "22001", date: "2026-10-13", costMicros: 12340000, impressions: 1000, clicks: 40, conversions: 2.5, conversionsValue: 0 });
});

test("indicadores somam as linhas e não dividem por zero", () => {
  const s = gaql.summarizeMetrics([
    { costMicros: 100_000_000, impressions: 10_000, clicks: 200, conversions: 10, conversionsValue: 500 },
    { costMicros: 50_000_000, impressions: 5_000, clicks: 100, conversions: 5, conversionsValue: 250 },
  ]);
  assert.equal(s.spend, 150);
  assert.equal(s.impressions, 15_000);
  assert.equal(s.clicks, 300);
  assert.equal(s.ctr, 2);
  assert.equal(s.cpc, 0.5);
  assert.equal(s.cpm, 10);
  assert.equal(s.conversions, 15);
  assert.equal(s.costPerConversion, 10);
  assert.equal(s.conversionRate, 5);
  assert.equal(s.conversionsValue, 750);
  assert.equal(s.roas, 5);
  const empty = gaql.summarizeMetrics([]);
  assert.equal(empty.ctr, null);
  assert.equal(empty.roas, null);
});

// ── Erros da API ────────────────────────────────────────────────────────────
test("erro de developer token não aprovado é reconhecido", () => {
  const e = gaql.parseGoogleAdsError(403, {
    error: { code: 403, status: "PERMISSION_DENIED", message: "The caller does not have permission", details: [{ errors: [{ errorCode: { authorizationError: "DEVELOPER_TOKEN_NOT_APPROVED" }, message: "The developer token is only approved for use with test accounts." }] }] },
  });
  assert.equal(e.kind, "developer_token_not_approved");
  assert.match(e.message, /test accounts/);
});

test("sem acesso à conta, token inválido e cota têm tipos próprios", () => {
  const perm = gaql.parseGoogleAdsError(403, { error: { details: [{ errors: [{ errorCode: { authorizationError: "USER_PERMISSION_DENIED" }, message: "x" }] }] } });
  assert.equal(perm.kind, "no_access");
  assert.equal(gaql.parseGoogleAdsError(401, { error: { status: "UNAUTHENTICATED", message: "x" } }).kind, "auth");
  assert.equal(gaql.parseGoogleAdsError(429, { error: { status: "RESOURCE_EXHAUSTED", message: "x" } }).kind, "quota");
  assert.equal(gaql.parseGoogleAdsError(500, null).kind, "error");
});

// ── Conta de serviço (JWT) ──────────────────────────────────────────────────
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const SA = {
  type: "service_account",
  client_email: "teste@projeto.iam.gserviceaccount.com",
  private_key: privateKey.export({ type: "pkcs8", format: "pem" }),
  token_uri: "https://oauth2.googleapis.com/token",
};

test("lê o JSON da conta de serviço e recusa formato errado", () => {
  assert.equal(parseServiceAccount(JSON.stringify(SA)).clientEmail, SA.client_email);
  assert.throws(() => parseServiceAccount("{}"), /conta de serviço inválida/);
  assert.throws(() => parseServiceAccount("não é json"), /conta de serviço inválida/);
});

test("JWT da conta de serviço tem escopo adwords, validade de 1 h e assinatura RS256 válida", () => {
  const sa = parseServiceAccount(JSON.stringify(SA));
  const jwt = buildServiceAccountAssertion(sa, 1_800_000_000);
  const [h, p, s] = jwt.split(".");
  const header = JSON.parse(Buffer.from(h, "base64url").toString());
  const payload = JSON.parse(Buffer.from(p, "base64url").toString());
  assert.deepEqual(header, { alg: "RS256", typ: "JWT" });
  assert.equal(payload.iss, SA.client_email);
  assert.equal(payload.scope, "https://www.googleapis.com/auth/adwords");
  assert.equal(payload.aud, SA.token_uri);
  assert.equal(payload.exp - payload.iat, 3600);
  const ok = createVerify("RSA-SHA256").update(`${h}.${p}`).verify(publicKey, Buffer.from(s, "base64url"));
  assert.equal(ok, true);
});

// ── Métricas extras e palavras-chave ───────────────────────────────────────
test("consulta extra: só campos da v26, período validado e só linhas com impressão", () => {
  const q = gaql.extraMetricsQuery("2026-10-01", "2026-10-21");
  for (const field of [
    "metrics.interactions", "metrics.all_conversions", "metrics.all_conversions_value",
    "metrics.search_impression_share", "metrics.search_budget_lost_impression_share",
    "metrics.search_rank_lost_impression_share", "metrics.content_budget_lost_impression_share",
    "metrics.top_impression_percentage", "metrics.absolute_top_impression_percentage",
    "metrics.video_trueview_views", "metrics.video_trueview_view_rate",
  ]) assert.ok(q.includes(field), field);
  assert.match(q, /BETWEEN '2026-10-01' AND '2026-10-21'/);
  assert.match(q, /metrics\.impressions > 0/);
  assert.throws(() => gaql.extraMetricsQuery("ontem", "2026-10-21"), /data inválida/);
});

test("métrica extra: parcela ausente fica nula (não é zero); contagens ausentes valem zero", () => {
  const m = gaql.mapExtraMetric({
    campaign: { id: "22001" },
    segments: { date: "2026-10-13" },
    metrics: { interactions: "40", allConversions: 3.5, searchImpressionShare: 0.62, topImpressionPercentage: "0.5" },
  });
  assert.deepEqual(m, {
    campaignId: "22001", date: "2026-10-13", interactions: 40, allConversions: 3.5, allConversionsValue: 0,
    searchImpressionShare: 0.62, searchBudgetLostImpressionShare: null, searchRankLostImpressionShare: null,
    contentBudgetLostImpressionShare: null, topImpressionPercentage: 0.5, absoluteTopImpressionPercentage: null,
    videoViews: 0, videoViewRate: null,
  });
});

test("palavras-chave: consulta limitada e ranking junta a mesma palavra de grupos diferentes", () => {
  const q = gaql.keywordsQuery("2026-10-01", "2026-10-21");
  assert.match(q, /FROM keyword_view/);
  assert.match(q, /ad_group_criterion\.quality_info\.quality_score/);
  assert.match(q, /LIMIT \d+/);

  const rows = [
    { adGroupCriterion: { keyword: { text: "curso de inglês" }, qualityInfo: { qualityScore: 8 } }, metrics: { impressions: "1000", clicks: "50", conversions: 4, costMicros: "40000000" } },
    { adGroupCriterion: { keyword: { text: "curso de inglês" }, qualityInfo: { qualityScore: 6 } }, metrics: { impressions: "1000", clicks: "30", conversions: 2, costMicros: "20000000" } },
    { adGroupCriterion: { keyword: { text: "inglês online" } }, metrics: { impressions: "2000", clicks: "10", conversions: 0, costMicros: "5000000" } },
  ];
  const s = gaql.summarizeKeywords(rows, 10);
  assert.deepEqual(s.ranking.map((k) => k.keyword), ["curso de inglês", "inglês online"]);
  assert.deepEqual(s.ranking[0], { keyword: "curso de inglês", conversions: 6, clicks: 80, cost: 60, costPerConversion: 10 });
  assert.equal(s.ranking[1].costPerConversion, null);
  // média ponderada por impressão, só onde há índice: (8×1000 + 6×1000) / 2000
  assert.equal(s.qualityScore, 7);
  assert.deepEqual(gaql.summarizeKeywords([], 10), { ranking: [], qualityScore: null });
});
