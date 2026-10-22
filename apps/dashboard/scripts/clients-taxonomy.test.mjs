// Rodar de apps/dashboard: node --test scripts/clients-taxonomy.test.mjs
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

const { taxonomyItemSchema, taxonomyTable, TAXONOMY_COLORS } = await import("../src/lib/clients/taxonomy.ts");
const { clientFieldsSchema, updateClientSchema } = await import("../src/lib/clients/schema.ts");

const UUID = "3b227bba-ce3a-4ff5-b58b-e35ce907e581";

test("item de taxonomia: apara o nome, cor padrão e recusa nome vazio, longo ou cor inválida", () => {
  assert.deepEqual(taxonomyItemSchema.parse({ name: "  Imobiliário " }), { name: "Imobiliário", color: TAXONOMY_COLORS[0] });
  assert.deepEqual(taxonomyItemSchema.parse({ name: "Saúde", color: "#AABBCC" }), { name: "Saúde", color: "#AABBCC" });
  assert.equal(taxonomyItemSchema.safeParse({ name: "   " }).success, false);
  assert.equal(taxonomyItemSchema.safeParse({ name: "x".repeat(61) }).success, false);
  assert.equal(taxonomyItemSchema.safeParse({ name: "A", color: "verde" }).success, false);
  assert.equal(taxonomyItemSchema.safeParse({ name: "A", extra: 1 }).success, false);
});

test("tipo de taxonomia vira a tabela certa; tipo desconhecido não vira tabela nenhuma", () => {
  assert.equal(taxonomyTable("segments"), "client_segments");
  assert.equal(taxonomyTable("products"), "client_products");
  assert.equal(taxonomyTable("clients"), null);
  assert.equal(taxonomyTable("client_segments; drop"), null);
});

test("cliente: segmento e produto aceitam uuid, vazio vira nulo e texto qualquer é recusado", () => {
  const parsed = clientFieldsSchema.parse({ name: "Go English", segment_id: UUID, product_id: "" });
  assert.equal(parsed.segment_id, UUID);
  assert.equal(parsed.product_id, null);
  assert.equal(clientFieldsSchema.safeParse({ name: "Go English", segment_id: "imobiliario" }).success, false);
  assert.deepEqual(updateClientSchema.parse({ product_id: null }), { product_id: null });
});
