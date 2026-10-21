// Rodar de apps/dashboard: node --test scripts/alerts.test.mjs
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

const triage = await import("../src/lib/alerts/triage.ts");
const evaluation = await import("../src/lib/alerts/evaluation.ts");
const message = await import("../src/lib/alerts/message.ts");
const build = await import("../src/lib/alerts/build.ts");
const schemas = await import("../src/lib/alerts/schemas.ts");
const present = await import("../src/lib/alerts/present.ts");

const plain = (s) => s.replace(/[  ]/g, " ");
const NOW = new Date("2026-10-16T12:30:00Z");
const ISO = NOW.toISOString();
const UUID_A = "11111111-1111-4111-8111-111111111111";
const UUID_B = "22222222-2222-4222-8222-222222222222";

test("estado de triagem vem só de acknowledged_at e resolved_at", () => {
  assert.equal(triage.triageState({ acknowledged_at: null, resolved_at: null }), "open");
  assert.equal(triage.triageState({ acknowledged_at: ISO, resolved_at: null }), "acknowledged");
  assert.equal(triage.triageState({ acknowledged_at: ISO, resolved_at: ISO }), "resolved");
  assert.equal(triage.triageState({ acknowledged_at: null, resolved_at: ISO }), "resolved");
});

test("reconhecer marca como lido para o sino continuar coerente", () => {
  const patch = triage.acknowledgePatch({ read_at: null }, NOW);
  assert.deepEqual(patch, { acknowledged_at: ISO, status: "read", read_at: ISO });
  const keepsRead = triage.acknowledgePatch({ read_at: "2026-10-15T10:00:00.000Z" }, NOW);
  assert.equal(keepsRead.read_at, "2026-10-15T10:00:00.000Z");
});

test("resolver exige nota, apara espaços e preserva o reconhecimento anterior", () => {
  const patch = triage.resolvePatch({ read_at: null, acknowledged_at: "2026-10-15T10:00:00.000Z" }, "  pausado o conjunto  ", NOW);
  assert.deepEqual(patch, {
    resolved_at: ISO,
    resolution_note: "pausado o conjunto",
    status: "read",
    read_at: ISO,
    acknowledged_at: "2026-10-15T10:00:00.000Z",
  });
  assert.throws(() => triage.resolvePatch({ read_at: null, acknowledged_at: null }, "   ", NOW));
});

test("transições válidas: reconhecer só aberto; resolver aberto ou reconhecido", () => {
  assert.equal(triage.transitionError("open", "acknowledge"), null);
  assert.ok(triage.transitionError("acknowledged", "acknowledge"));
  assert.ok(triage.transitionError("resolved", "acknowledge"));
  assert.equal(triage.transitionError("open", "resolve"), null);
  assert.equal(triage.transitionError("acknowledged", "resolve"), null);
  assert.ok(triage.transitionError("resolved", "resolve"));
});

test("valor da métrica: ausência de base vira null, nunca zero", () => {
  const t = (o) => ({ spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, ...o });
  assert.equal(evaluation.metricValue("roas", t({ spend: 0, revenue: 0 })), null);
  assert.equal(evaluation.metricValue("roas", t({ spend: 100, revenue: 150 })), 1.5);
  assert.equal(evaluation.metricValue("cpa", t({ spend: 100, conversions: 0 })), null);
  assert.equal(evaluation.metricValue("cpa", t({ spend: 100, conversions: 4 })), 25);
  assert.equal(evaluation.metricValue("spend_no_conversion", t({ spend: 80, conversions: 0 })), 80);
  assert.equal(evaluation.metricValue("spend_no_conversion", t({ spend: 80, conversions: 1 })), null);
  assert.equal(evaluation.metricValue("spend_no_conversion", t({ spend: 0, conversions: 0 })), null);
  assert.equal(evaluation.metricValue("ctr_below", t({ impressions: 0, clicks: 0 })), null);
  assert.equal(evaluation.metricValue("ctr_below", t({ impressions: 2000, clicks: 10 })), 0.5);
  assert.equal(evaluation.metricValue("balance_below", t({ spend: 10 })), null);
});

test("soma das linhas diárias ignora valores inválidos", () => {
  const totals = evaluation.aggregateTotals([
    { spend: 10, impressions: 100, clicks: 2, conversions: 1, revenue_attributed: 30 },
    { spend: null, impressions: "50", clicks: 1, conversions: null, revenue_attributed: Number.NaN },
  ]);
  assert.deepEqual(totals, { spend: 10, impressions: 150, clicks: 3, conversions: 1, revenue: 30 });
});

test("cruzamento do limite respeita o operador", () => {
  assert.equal(evaluation.crosses(1.5, "lt", 2), true);
  assert.equal(evaluation.crosses(2, "lt", 2), false);
  assert.equal(evaluation.crosses(50, "gt", 45), true);
  assert.equal(evaluation.crosses(45, "eq", 45), true);
  assert.equal(evaluation.defaultOperator("roas"), "lt");
  assert.equal(evaluation.defaultOperator("ctr_below"), "lt");
  assert.equal(evaluation.defaultOperator("cpa"), "gt");
  assert.equal(evaluation.defaultOperator("spend_no_conversion"), "gt");
});

test("severidade pela distância relativa além do limite: ≥50% crítico, ≥20% atenção, resto info", () => {
  assert.equal(evaluation.severityFor(0.9, "lt", 2), "critical");
  assert.equal(evaluation.severityFor(1.5, "lt", 2), "warning");
  assert.equal(evaluation.severityFor(1.9, "lt", 2), "info");
  assert.equal(evaluation.severityFor(70, "gt", 45), "critical");
  assert.equal(evaluation.severityFor(55, "gt", 45), "warning");
  assert.equal(evaluation.severityFor(46, "gt", 45), "info");
  assert.equal(evaluation.severityFor(10, "gt", 0), "warning");
  assert.equal(evaluation.severityFor(45, "eq", 45), "info");
});

test("erro de API: status ruim é crítico; sincronização parada é atenção", () => {
  const base = { status: "active", last_synced_at: "2026-10-16T10:00:00Z", connected_at: "2026-09-01T00:00:00Z" };
  assert.equal(evaluation.apiErrorCheck(base, NOW, 24).failing, false);

  const expired = evaluation.apiErrorCheck({ ...base, status: "expired" }, NOW, 24);
  assert.equal(expired.failing, true);
  assert.equal(expired.reason, "status");
  assert.equal(expired.severity, "critical");

  const stale = evaluation.apiErrorCheck({ ...base, last_synced_at: "2026-10-14T12:30:00Z" }, NOW, 24);
  assert.equal(stale.failing, true);
  assert.equal(stale.reason, "stale");
  assert.equal(stale.severity, "warning");
  assert.equal(stale.hoursSinceSync, 48);

  const never = evaluation.apiErrorCheck({ ...base, last_synced_at: null }, NOW, 24);
  assert.equal(never.reason, "never_synced");
  const fresh = evaluation.apiErrorCheck({ ...base, last_synced_at: null, connected_at: "2026-10-16T11:00:00Z" }, NOW, 24);
  assert.equal(fresh.failing, false);
  assert.equal(evaluation.apiErrorCheck({ ...base, last_synced_at: "2026-10-01T00:00:00Z" }, NOW, 0).failing, false);
});

test("período avaliado é o último dia completo no fuso de São Paulo", () => {
  assert.deepEqual(evaluation.evaluationPeriod(NOW), { start: "2026-10-15", end: "2026-10-15", key: "2026-10-15" });
  const lateNightSp = new Date("2026-10-16T02:00:00Z");
  assert.equal(evaluation.evaluationPeriod(lateNightSp).key, "2026-10-14");
  assert.equal(evaluation.evaluationPeriod(new Date("2026-03-01T12:00:00Z")).key, "2026-02-28");
});

test("dedupe: não recria enquanto aberto/reconhecido; resolvido volta só em período novo", () => {
  const target = "account:acc-1";
  const open = { campaign_id: null, metadata: { target_key: target, period_end: "2026-10-14" }, acknowledged_at: null, resolved_at: null, triggered_at: ISO };
  assert.deepEqual(evaluation.dedupeDecision([open], target, "2026-10-15"), { create: false, reason: "open" });

  const acked = { ...open, acknowledged_at: ISO };
  assert.deepEqual(evaluation.dedupeDecision([acked], target, "2026-10-15"), { create: false, reason: "acknowledged" });

  const resolvedSame = { ...open, metadata: { target_key: target, period_end: "2026-10-15" }, resolved_at: ISO };
  assert.deepEqual(evaluation.dedupeDecision([resolvedSame], target, "2026-10-15"), { create: false, reason: "same_period" });

  const resolvedOld = { ...resolvedSame, metadata: { target_key: target, period_end: "2026-10-14" } };
  assert.deepEqual(evaluation.dedupeDecision([resolvedOld], target, "2026-10-15"), { create: true, reason: null });

  const otherTarget = { ...open, metadata: { target_key: "account:acc-2" } };
  assert.deepEqual(evaluation.dedupeDecision([otherTarget], target, "2026-10-15"), { create: true, reason: null });

  const legacy = { campaign_id: "camp-1", metadata: {}, acknowledged_at: null, resolved_at: null, triggered_at: ISO };
  assert.equal(evaluation.dedupeDecision([legacy], "campaign:camp-1", "2026-10-15").create, false);
});

test("modelo: usa template_body da regra; sem ele cai no preset da condição", () => {
  assert.equal(message.presetConditionFor("roas"), "roas_below");
  assert.equal(message.presetConditionFor("cpa"), "cpa_above");
  assert.equal(message.presetConditionFor("spend_no_conversion"), "spend_no_conversion");
  assert.equal(message.presetConditionFor("ctr_below"), "ctr_below");
  assert.match(message.defaultTemplate("cpa"), /CPA elevado/);

  const ctx = { value: 1.5, threshold: 2, accountName: "Conta Alfa", period: { start: "2026-10-15", end: "2026-10-15" }, spend: 300, currency: "BRL" };
  const fromPreset = message.buildAlertMessage({ metric: "roas", template_body: null }, ctx);
  assert.match(plain(fromPreset.text), /Conta Alfa\*, o ROAS ficou em 1,5x, abaixo da meta de 2x/);
  assert.match(fromPreset.text, /15\/10\/2026 a 15\/10\/2026/);
  assert.deepEqual(fromPreset.missing, []);

  const custom = message.buildAlertMessage({ metric: "roas", template_body: "{{account_name}}: {{current_value}} | {{account_status}}" }, ctx);
  assert.equal(custom.text, "Conta Alfa: 1,5x | —");
  assert.deepEqual(custom.missing, ["account_status"]);
});

test("formatação por métrica: moeda, porcentagem, multiplicador", () => {
  assert.equal(plain(message.formatMetricValue("cpa", 52.5, "BRL")), "R$ 52,50");
  assert.equal(plain(message.formatMetricValue("spend_no_conversion", 80, "BRL")), "R$ 80,00");
  assert.equal(message.formatMetricValue("ctr_below", 0.456), "0,46%");
  assert.equal(message.formatMetricValue("roas", 1.234), "1,23x");
  assert.equal(message.formatMetricValue("api_error", 30), "30 h");
  assert.equal(message.formatMetricValue("roas", null), "—");
});

test("linha de alerta montada para inserção carrega alvo, período e severidade", () => {
  const rule = { id: UUID_A, org_id: UUID_B, metric: "cpa", operator: "gt", threshold: 45, channel: "web_push", template_body: null };
  const row = build.buildAlertInsert(
    rule,
    { kind: "account", id: "acc-1", value: 70.456, accountName: "Conta Alfa", accountId: "acc-1", clientId: "cli-1", clientName: "Clínica X", campaignName: null, currency: "BRL", spend: 704.56, accountStatus: "active" },
    { start: "2026-10-15", end: "2026-10-15", key: "2026-10-15" },
    NOW,
  );
  assert.equal(row.severity, "critical");
  assert.equal(row.campaign_id, null);
  assert.equal(row.observed_value, 70.46);
  assert.equal(row.status, "unread");
  assert.equal(row.title, "CPA acima do limite");
  assert.equal(row.metadata.target_key, "account:acc-1");
  assert.equal(row.metadata.period_end, "2026-10-15");
  assert.equal(row.metadata.client_name, "Clínica X");
  assert.match(plain(row.message), /R\$ 70,46/);

  const camp = build.buildAlertInsert(
    { ...rule, metric: "ctr_below", operator: "lt", threshold: 0.8 },
    { kind: "campaign", id: "camp-9", value: 0.5, accountName: "Conta Alfa", accountId: "acc-1", clientId: null, clientName: null, campaignName: "Black", currency: "BRL", spend: 10, accountStatus: "active" },
    { start: "2026-10-15", end: "2026-10-15", key: "2026-10-15" },
    NOW,
  );
  assert.equal(camp.campaign_id, "camp-9");
  assert.equal(camp.metadata.target_key, "campaign:camp-9");
  assert.equal(camp.severity, "warning");
});

test("consulta da triagem: filtros validados, limite limitado, padrão = abertos", () => {
  const q = schemas.parseTriageQuery(new URLSearchParams(""));
  assert.equal(q.success, true);
  assert.deepEqual(q.data, { state: "open", severity: "all", assigned_to: "all", page: 1, limit: 25 });

  const full = schemas.parseTriageQuery(new URLSearchParams(`state=resolved&severity=critical&assigned_to=${UUID_A}&page=3&limit=50`));
  assert.deepEqual(full.data, { state: "resolved", severity: "critical", assigned_to: UUID_A, page: 3, limit: 50 });

  assert.equal(schemas.parseTriageQuery(new URLSearchParams("limit=500")).success, false);
  assert.equal(schemas.parseTriageQuery(new URLSearchParams("state=lido")).success, false);
  assert.equal(schemas.parseTriageQuery(new URLSearchParams("assigned_to=fulano")).success, false);
  assert.equal(schemas.parseTriageQuery(new URLSearchParams("assigned_to=me")).data.assigned_to, "me");
});

test("corpo de resolver e de atribuir", () => {
  assert.equal(schemas.resolveBodySchema.safeParse({ note: "ok" }).success, true);
  assert.equal(schemas.resolveBodySchema.safeParse({ note: "   " }).success, false);
  assert.equal(schemas.resolveBodySchema.safeParse({}).success, false);
  assert.equal(schemas.resolveBodySchema.safeParse({ note: "x".repeat(2001) }).success, false);
  assert.equal(schemas.resolveBodySchema.safeParse({ note: "x".repeat(2000) }).success, true);

  assert.equal(schemas.assignBodySchema.safeParse({ assigned_to: UUID_A }).success, true);
  assert.equal(schemas.assignBodySchema.safeParse({ assigned_to: null }).success, true);
  assert.equal(schemas.assignBodySchema.safeParse({ assigned_to: "x" }).success, false);
  assert.equal(schemas.assignBodySchema.safeParse({ assigned_to: UUID_A, org_id: UUID_B }).success, false);
});

test("regra: condições suportadas, saldo fora até existir leitura de saldo", () => {
  const ok = schemas.ruleCreateSchema.safeParse({ metric: "ctr_below", threshold: 0.8, template_body: "{{account_name}}" });
  assert.equal(ok.success, true);
  assert.equal(ok.data.operator, undefined);
  assert.equal(schemas.ruleCreateSchema.safeParse({ metric: "balance_below", threshold: 100 }).success, false);
  assert.equal(schemas.ruleCreateSchema.safeParse({ metric: "roas", threshold: -1 }).success, false);
  assert.equal(schemas.ruleCreateSchema.safeParse({ metric: "roas", threshold: 2, client_id: "x" }).success, false);
  assert.equal(schemas.ruleCreateSchema.safeParse({ metric: "roas", threshold: 2, template_body: "x".repeat(4001) }).success, false);
  assert.equal(schemas.ruleUpdateSchema.safeParse({}).success, false);
  assert.equal(schemas.ruleUpdateSchema.safeParse({ active: false }).success, true);
});

test("rótulos nunca dependem só de cor", () => {
  assert.deepEqual(present.SEVERITY_PRESENTATION.critical, { label: "Crítico", tone: "bad" });
  assert.deepEqual(present.STATE_PRESENTATION.acknowledged, { label: "Reconhecido", tone: "neu" });
  assert.equal(present.severityPresentation(null).label, "—");
  assert.equal(present.metricLabel("ctr_below"), "CTR abaixo do limite");
  assert.equal(present.operatorSymbol("gt"), ">");
});
