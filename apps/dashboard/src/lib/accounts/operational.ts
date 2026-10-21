import "server-only";

import type { DashboardSession } from "@/lib/auth/session";
import type { Database } from "@/lib/supabase/types";
import {
  evaluateOperationalAccount,
  filterOperationalAccounts,
  type IneligibilityReason,
  type OperationalAccountCandidate,
} from "./eligibility";

type AuthorizedSession = Extract<DashboardSession, { isAuthorized: true }>;
type OperationalDb = AuthorizedSession["supabase"];
type AccountRow = Database["public"]["Tables"]["ad_accounts"]["Row"];
type ClientRow = Database["public"]["Tables"]["clients"]["Row"];

const ACCOUNT_SELECT =
  "id, external_id, name, currency, timezone, status, platform, client_id, org_id, token_encrypted, last_synced_at, connected_at";

export type OperationalClient = Pick<ClientRow, "id" | "name" | "org_id" | "archived_at">;

export type OperationalAccount = Pick<
  AccountRow,
  | "id"
  | "external_id"
  | "name"
  | "currency"
  | "timezone"
  | "status"
  | "platform"
  | "client_id"
  | "org_id"
  | "token_encrypted"
  | "last_synced_at"
  | "connected_at"
> & {
  client: OperationalClient;
};

export type OperationalInventory = {
  accounts: OperationalAccount[];
  clients: OperationalClient[];
};

export class OperationalAccountError extends Error {
  constructor(
    public readonly status: 403 | 404 | 500,
    public readonly code: "ACCOUNT_NOT_FOUND" | "ACCOUNT_NOT_AUTHORIZED" | "ACCOUNT_LOOKUP_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "OperationalAccountError";
  }
}

function candidateOf(account: AccountRow, client: OperationalClient | null): OperationalAccountCandidate {
  return {
    id: account.id,
    externalId: account.external_id,
    orgId: account.org_id,
    platform: account.platform,
    status: account.status,
    clientId: account.client_id,
    clientOrgId: client?.org_id ?? null,
    clientArchivedAt: client?.archived_at ?? null,
  };
}

function authorizationMessage(reason: IneligibilityReason): string {
  switch (reason) {
    case "unlinked_account":
      return "Conta descoberta, mas ainda não autorizada pela Carteira.";
    case "inactive_account":
      return "Conta inativa ou com conexão expirada.";
    case "archived_client":
      return "O cliente vinculado está arquivado.";
    case "client_mismatch":
      return "A conta não pertence ao cliente informado.";
    default:
      return "Conta não autorizada para esta organização.";
  }
}

export async function listOperationalAccounts(
  db: OperationalDb,
  orgId: string,
  platform?: string,
): Promise<OperationalInventory> {
  let accountsQuery = db
    .from("ad_accounts")
    .select(ACCOUNT_SELECT)
    .eq("org_id", orgId)
    .eq("status", "active")
    .not("client_id", "is", null);

  if (platform) accountsQuery = accountsQuery.eq("platform", platform);

  const [accountsResult, clientsResult] = await Promise.all([
    accountsQuery.order("name", { ascending: true }),
    db
      .from("clients")
      .select("id, name, org_id, archived_at")
      .eq("org_id", orgId)
      .is("archived_at", null)
      .order("name", { ascending: true }),
  ]);

  if (accountsResult.error || clientsResult.error) {
    throw new OperationalAccountError(
      500,
      "ACCOUNT_LOOKUP_FAILED",
      accountsResult.error?.message ?? clientsResult.error?.message ?? "Falha ao consultar contas.",
    );
  }

  const clients = (clientsResult.data ?? []) as OperationalClient[];
  const clientsById = new Map(clients.map((client) => [client.id, client]));
  const rows = (accountsResult.data ?? []) as AccountRow[];
  const candidates = rows.map((account) => ({ account, client: clientsById.get(account.client_id ?? "") ?? null }));
  const eligibleIds = new Set(
    filterOperationalAccounts(
      candidates.map(({ account, client }) => candidateOf(account, client)),
      { orgId, platform },
    ).map((candidate) => candidate.id),
  );

  return {
    accounts: candidates
      .filter(({ account }) => eligibleIds.has(account.id))
      .map(({ account, client }) => ({ ...account, client: client! })),
    clients,
  };
}

export async function resolveOperationalAccount(
  db: OperationalDb,
  input: {
    orgId: string;
    accountId?: string;
    externalId?: string;
    clientId?: string | null;
    platform?: string;
  },
): Promise<OperationalAccount> {
  let query = db
    .from("ad_accounts")
    .select(ACCOUNT_SELECT)
    .eq("org_id", input.orgId);

  if (input.platform) query = query.eq("platform", input.platform);
  if (input.accountId) query = query.eq("id", input.accountId);
  else if (input.externalId) query = query.eq("external_id", input.externalId);
  else {
    throw new OperationalAccountError(404, "ACCOUNT_NOT_FOUND", "Conta não informada.");
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new OperationalAccountError(500, "ACCOUNT_LOOKUP_FAILED", error.message);
  }
  if (!data) {
    throw new OperationalAccountError(404, "ACCOUNT_NOT_FOUND", "Conta não encontrada.");
  }

  const account = data as AccountRow;
  let client: OperationalClient | null = null;
  if (account.client_id) {
    const clientResult = await db
      .from("clients")
      .select("id, name, org_id, archived_at")
      .eq("id", account.client_id)
      .maybeSingle();
    if (clientResult.error) {
      throw new OperationalAccountError(500, "ACCOUNT_LOOKUP_FAILED", clientResult.error.message);
    }
    client = clientResult.data as OperationalClient | null;
  }

  const eligibility = evaluateOperationalAccount(candidateOf(account, client), {
    orgId: input.orgId,
    clientId: input.clientId,
    platform: input.platform,
  });
  if (!eligibility.eligible) {
    throw new OperationalAccountError(
      403,
      "ACCOUNT_NOT_AUTHORIZED",
      authorizationMessage(eligibility.reason),
    );
  }

  return { ...account, client: client! };
}
