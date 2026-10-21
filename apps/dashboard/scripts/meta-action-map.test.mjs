// Rodar de apps/dashboard: node --test scripts/meta-action-map.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

const { toActionMap } = await import("../src/lib/meta/action-map.ts");

test("converte o array da Graph API em objeto plano com números", () => {
  const map = toActionMap([
    { action_type: "purchase", value: "3" },
    { action_type: "lead", value: "12" },
    { action_type: "offsite_conversion.fb_pixel_purchase", value: "1890.50" },
  ]);
  assert.deepEqual(map, { purchase: 3, lead: 12, "offsite_conversion.fb_pixel_purchase": 1890.5 });
});

test("sem actions devolve objeto vazio", () => {
  assert.deepEqual(toActionMap(undefined), {});
  assert.deepEqual(toActionMap(null), {});
  assert.deepEqual(toActionMap([]), {});
});

test("ignora tipo vazio e valor não numérico; soma tipos repetidos", () => {
  const map = toActionMap([
    { action_type: "", value: "1" },
    { action_type: "lead", value: "abc" },
    { action_type: "lead", value: "2" },
    { action_type: "lead", value: 3 },
  ]);
  assert.deepEqual(map, { lead: 5 });
});

test("chaves especiais não herdam do protótipo", () => {
  const map = toActionMap([
    { action_type: "constructor", value: "2" },
    { action_type: "toString", value: "1" },
  ]);
  assert.equal(map.constructor, 2);
  assert.equal(map.toString, 1);
});

test("não altera o array de entrada", () => {
  const input = Object.freeze([Object.freeze({ action_type: "purchase", value: "1" })]);
  assert.deepEqual(toActionMap(input), { purchase: 1 });
});
