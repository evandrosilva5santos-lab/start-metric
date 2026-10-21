import { test } from "node:test";
import assert from "node:assert/strict";

const {
  buildAccountGroups,
  filterAccountGroups,
  groupSummary,
  groupLabel,
  partitionRequestedIds,
  PERSONAL_GROUP_LABEL,
} = await import("../src/lib/meta/account-groups.ts");

const graph = Object.freeze([
  { id: "act_3", name: "Zeta Loja", currency: "BRL", account_status: 1, business: { id: "bm_2", name: "Agência Beta" } },
  { id: "act_1", name: "Ótica Alfa", currency: "USD", account_status: 2, business: { id: "bm_1", name: "agência alfa" } },
  { id: "act_2", name: "Clínica Sorriso", currency: "BRL", account_status: 1, business: { id: "bm_2", name: "Agência Beta" } },
  { id: "act_9", name: "Minha conta", currency: "BRL", account_status: 1 },
  { id: "act_8", name: "", currency: null, business: null },
]);

const panel = Object.freeze([
  { externalId: "act_2", status: "active", clientName: "Clínica Sorriso" },
  { externalId: "act_3", status: "hidden", clientName: null },
  { externalId: "act_9", status: "expired", clientName: null },
]);

test("agrupa contas por gerenciador, em ordem alfabética, com contas pessoais por último", () => {
  const groups = buildAccountGroups(graph, panel);
  assert.deepEqual(
    groups.map((group) => group.business?.id ?? null),
    ["bm_1", "bm_2", null],
  );
  assert.deepEqual(
    groups[1].accounts.map((account) => account.externalId),
    ["act_2", "act_3"],
  );
  assert.equal(groupLabel(groups[2]), PERSONAL_GROUP_LABEL);
  assert.equal(groupLabel(groups[0]), "agência alfa");
});

test("marca o estado de cada conta no painel sem confundir oculta com ativa", () => {
  const groups = buildAccountGroups(graph, panel);
  const byId = new Map(groups.flatMap((group) => group.accounts).map((account) => [account.externalId, account]));
  assert.deepEqual(
    { inPanel: byId.get("act_2").inPanel, hidden: byId.get("act_2").hidden, clientName: byId.get("act_2").clientName },
    { inPanel: true, hidden: false, clientName: "Clínica Sorriso" },
  );
  assert.deepEqual({ inPanel: byId.get("act_3").inPanel, hidden: byId.get("act_3").hidden }, { inPanel: false, hidden: true });
  assert.equal(byId.get("act_9").inPanel, true);
  assert.deepEqual({ inPanel: byId.get("act_1").inPanel, hidden: byId.get("act_1").hidden, clientName: byId.get("act_1").clientName }, {
    inPanel: false,
    hidden: false,
    clientName: null,
  });
});

test("usa o id quando a conta não tem nome e preserva ausência de moeda e status", () => {
  const groups = buildAccountGroups(graph, []);
  const nameless = groups.flatMap((group) => group.accounts).find((account) => account.externalId === "act_8");
  assert.equal(nameless.name, "act_8");
  assert.equal(nameless.currency, null);
  assert.equal(nameless.accountStatus, null);
});

test("ignora contas repetidas e ids fora do formato act_<dígitos>", () => {
  const groups = buildAccountGroups(
    [
      { id: "act_5", name: "A", business: { id: "bm_1", name: "BM" } },
      { id: "act_5", name: "A de novo", business: { id: "bm_1", name: "BM" } },
      { id: "5", name: "Sem prefixo" },
      { id: "act_x", name: "Inválida" },
    ],
    [],
  );
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].accounts.map((account) => account.name), ["A"]);
});

test("gerenciador sem nome recebe rótulo com o id", () => {
  const [group] = buildAccountGroups([{ id: "act_1", name: "A", business: { id: "777", name: "" } }], []);
  assert.equal(groupLabel(group), "Gerenciador 777");
});

test("busca por nome da conta ignora acentos e caixa", () => {
  const groups = buildAccountGroups(graph, panel);
  const found = filterAccountGroups(groups, "otica");
  assert.equal(found.length, 1);
  assert.deepEqual(found[0].accounts.map((account) => account.externalId), ["act_1"]);
});

test("busca pelo número da conta com ou sem o prefixo act_", () => {
  const groups = buildAccountGroups(graph, panel);
  assert.deepEqual(filterAccountGroups(groups, "act_9").flatMap((group) => group.accounts.map((a) => a.externalId)), ["act_9"]);
  assert.deepEqual(filterAccountGroups(groups, " 9 ").flatMap((group) => group.accounts.map((a) => a.externalId)), ["act_9"]);
});

test("busca pelo nome do gerenciador traz todas as contas dele", () => {
  const groups = buildAccountGroups(graph, panel);
  const found = filterAccountGroups(groups, "agencia beta");
  assert.equal(found.length, 1);
  assert.equal(found[0].accounts.length, 2);
});

test("busca vazia devolve os grupos intactos e busca sem resultado devolve lista vazia", () => {
  const groups = buildAccountGroups(graph, panel);
  assert.equal(filterAccountGroups(groups, "   "), groups);
  assert.deepEqual(filterAccountGroups(groups, "inexistente"), []);
});

test("resumo do grupo conta total e contas já no painel", () => {
  const groups = buildAccountGroups(graph, panel);
  assert.deepEqual(groupSummary(groups[1]), { total: 2, inPanel: 1 });
});

test("separa ids pedidos entre válidos da conexão e desconhecidos, sem duplicar", () => {
  const result = partitionRequestedIds(["act_1", "act_404", "act_1", "act_2"], ["act_1", "act_2", "act_3"]);
  assert.deepEqual(result, { valid: ["act_1", "act_2"], unknown: ["act_404"] });
});

test("não altera as entradas recebidas", () => {
  const input = [{ id: "act_1", name: "A", business: { id: "bm", name: "BM" } }];
  const snapshot = JSON.stringify(input);
  const groups = buildAccountGroups(input, []);
  filterAccountGroups(groups, "a");
  assert.equal(JSON.stringify(input), snapshot);
});
