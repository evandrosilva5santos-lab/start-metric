import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const { evaluateOperationalAccount, filterOperationalAccounts } = await import(
  "../src/lib/accounts/eligibility.ts"
);
const { resolveOperationalSelection } = await import("../src/lib/accounts/selection.ts");

const base = Object.freeze({
  id: "account-db-id",
  externalId: "act_123",
  orgId: "org-a",
  platform: "meta",
  status: "active",
  clientId: "client-a",
  clientOrgId: "org-a",
  clientArchivedAt: null,
});

test("autoriza conta ativa vinculada a cliente não arquivado da mesma organização", () => {
  assert.deepEqual(evaluateOperationalAccount(base, { orgId: "org-a", clientId: "client-a" }), {
    eligible: true,
  });
});

test("recusa conta descoberta que ainda não foi autorizada pela Carteira", () => {
  assert.deepEqual(evaluateOperationalAccount({ ...base, clientId: null }, { orgId: "org-a" }), {
    eligible: false,
    reason: "unlinked_account",
  });
});

test("recusa conta inativa", () => {
  assert.deepEqual(evaluateOperationalAccount({ ...base, status: "disconnected" }, { orgId: "org-a" }), {
    eligible: false,
    reason: "inactive_account",
  });
});

test("recusa cliente arquivado", () => {
  assert.deepEqual(evaluateOperationalAccount({ ...base, clientArchivedAt: "2026-10-17T00:00:00Z" }, { orgId: "org-a" }), {
    eligible: false,
    reason: "archived_client",
  });
});

test("recusa conta ou cliente de outra organização", () => {
  assert.equal(evaluateOperationalAccount({ ...base, orgId: "org-b" }, { orgId: "org-a" }).reason, "cross_org_account");
  assert.equal(evaluateOperationalAccount({ ...base, clientOrgId: "org-b" }, { orgId: "org-a" }).reason, "cross_org_client");
});

test("recusa conta vinculada a outro cliente", () => {
  assert.deepEqual(evaluateOperationalAccount(base, { orgId: "org-a", clientId: "client-b" }), {
    eligible: false,
    reason: "client_mismatch",
  });
});

test("todas as contas agrega somente IDs elegíveis no cliente selecionado", () => {
  const rows = [
    base,
    { ...base, id: "second", externalId: "act_456" },
    { ...base, id: "unlinked", externalId: "act_789", clientId: null },
    { ...base, id: "inactive", externalId: "act_999", status: "expired" },
    { ...base, id: "other-client", externalId: "act_555", clientId: "client-b" },
  ];

  assert.deepEqual(
    filterOperationalAccounts(rows, { orgId: "org-a", clientId: "client-a" }).map((row) => row.id),
    ["account-db-id", "second"],
  );
});

test("descarta seleção persistida fora do cliente e escolhe a primeira conta válida", () => {
  const accounts = [
    { id: "act_1", clientId: "client-a", platform: "meta", isActive: true },
    { id: "act_2", clientId: "client-b", platform: "meta", isActive: true },
  ];
  assert.deepEqual(
    resolveOperationalSelection(accounts, {
      clientId: "client-a",
      platform: "meta",
      accountId: "act_2",
    }),
    { clientId: "client-a", platform: "meta", accountId: "act_1" },
  );
});

test("sem inventário operacional limpa cliente e conta", () => {
  assert.deepEqual(
    resolveOperationalSelection([], {
      clientId: "client-antigo",
      platform: "meta",
      accountId: "act_antiga",
    }),
    { clientId: "", platform: "meta", accountId: "" },
  );
});

test("migration instala FK same-org, view operacional e confirmação transacional", async () => {
  const sql = await readFile(
    new URL("../supabase/migrations/20261017001000_account_authorization_core.sql", import.meta.url),
    "utf8",
  );
  assert.match(sql, /FOREIGN KEY \(org_id, client_id\)/);
  assert.match(sql, /operational_ad_accounts/);
  assert.match(sql, /FOR UPDATE/);
  assert.match(sql, /ACCOUNT_REASSIGNMENT_CONFIRMATION_REQUIRED/);
  assert.match(sql, /p_confirm_reassignment BOOLEAN DEFAULT FALSE/);
});
