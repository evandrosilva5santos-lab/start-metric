// Rodar de apps/dashboard: node --test scripts/channels-overview.test.mjs
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

const { buildChannelOverview } = await import("../src/lib/dashboard/channels.ts");

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `esperado ${b}, veio ${a}`);

const META = [
  { date: "2026-10-14", spend: 100, impressions: 10000, clicks: 200, conversions: 4, revenue_attributed: 500 },
  { date: "2026-10-15", spend: 50, impressions: 5000, clicks: 100, conversions: 1, revenue_attributed: 0 },
];
const GOOGLE = [
  { date: "2026-10-15", cost_micros: 100000000, impressions: 5000, clicks: 300, conversions: 10, conversions_value: 300 },
  { date: "2026-10-16", cost_micros: 50000000, impressions: 1000, clicks: 50, conversions: 0, conversions_value: 0 },
];

test("comparativo: cada canal com seus números e o total recalculado", () => {
  const o = buildChannelOverview(META, GOOGLE, "2026-10-14", "2026-10-16");
  close(o.meta.spend, 150);
  assert.equal(o.meta.conversions, 5);
  close(o.meta.roas, 500 / 150);
  close(o.google.spend, 150);
  assert.equal(o.google.conversions, 10);
  close(o.google.roas, 2);
  close(o.total.spend, 300);
  assert.equal(o.total.clicks, 650);
  assert.equal(o.total.conversions, 15);
  close(o.total.ctr, (650 / 21000) * 100);
  close(o.total.cpc, 300 / 650);
  close(o.total.roas, 800 / 300);
});

test("série diária cobre todo o período, com zero onde o canal não gastou", () => {
  const o = buildChannelOverview(META, GOOGLE, "2026-10-14", "2026-10-16");
  assert.deepEqual(o.daily, [
    { date: "2026-10-14", meta: 100, google: 0 },
    { date: "2026-10-15", meta: 50, google: 100 },
    { date: "2026-10-16", meta: 0, google: 50 },
  ]);
});

test("canal sem dado fica nulo nas taxas e zerado nas somas", () => {
  const o = buildChannelOverview([], GOOGLE, "2026-10-15", "2026-10-16");
  assert.equal(o.meta.spend, 0);
  assert.equal(o.meta.ctr, null);
  assert.equal(o.meta.roas, null);
  close(o.total.spend, o.google.spend);
  assert.equal(o.hasMeta, false);
  assert.equal(o.hasGoogle, true);
});
