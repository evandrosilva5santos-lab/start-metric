// Rodar de apps/dashboard: node --test scripts/google-period.test.mjs
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

const { rangeFor, shiftDay, isValidRange } = await import("../src/lib/google-ads/period.ts");

test("shiftDay: atravessa mês e ano", () => {
  assert.equal(shiftDay("2026-03-01", -1), "2026-02-28");
  assert.equal(shiftDay("2026-01-01", -1), "2025-12-31");
  assert.equal(shiftDay("2026-12-31", 1), "2027-01-01");
});

test("rangeFor: períodos rápidos terminam ontem; este mês termina hoje", () => {
  const today = "2026-10-22";
  assert.deepEqual(rangeFor("7d", today), { from: "2026-10-15", to: "2026-10-21" });
  assert.deepEqual(rangeFor("14d", today), { from: "2026-10-08", to: "2026-10-21" });
  assert.deepEqual(rangeFor("30d", today), { from: "2026-09-22", to: "2026-10-21" });
  assert.deepEqual(rangeFor("month", today), { from: "2026-10-01", to: "2026-10-22" });
});

test("rangeFor: mês passado inclui o mês todo, inclusive na virada de ano", () => {
  assert.deepEqual(rangeFor("last_month", "2026-10-22"), { from: "2026-09-01", to: "2026-09-30" });
  assert.deepEqual(rangeFor("last_month", "2026-01-05"), { from: "2025-12-01", to: "2025-12-31" });
  assert.deepEqual(rangeFor("last_month", "2026-03-10"), { from: "2026-02-01", to: "2026-02-28" });
});

test("isValidRange: exige datas reais, início antes do fim e no máximo 366 dias", () => {
  assert.equal(isValidRange("2026-10-01", "2026-10-22"), true);
  assert.equal(isValidRange("2026-10-22", "2026-10-22"), true);
  assert.equal(isValidRange("2026-10-23", "2026-10-22"), false);
  assert.equal(isValidRange("2026-13-01", "2026-13-05"), false);
  assert.equal(isValidRange("", "2026-10-22"), false);
  assert.equal(isValidRange("2025-01-01", "2026-10-22"), false);
});
