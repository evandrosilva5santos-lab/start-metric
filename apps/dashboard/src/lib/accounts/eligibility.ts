export type OperationalAccountCandidate = {
  id: string;
  externalId: string;
  orgId: string;
  platform: string;
  status: string;
  clientId: string | null;
  clientOrgId: string | null;
  clientArchivedAt: string | null;
};

export type OperationalScope = {
  orgId: string;
  clientId?: string | null;
  platform?: string | null;
};

export type IneligibilityReason =
  | "cross_org_account"
  | "unsupported_platform"
  | "unlinked_account"
  | "inactive_account"
  | "missing_client"
  | "cross_org_client"
  | "archived_client"
  | "client_mismatch";

export type EligibilityResult =
  | { eligible: true }
  | { eligible: false; reason: IneligibilityReason };

/**
 * Política pura e canônica para todas as superfícies operacionais.
 * Descobrir uma conta nunca é suficiente: somente o vínculo feito na
 * Carteira, dentro do tenant, transforma a conta em operacional.
 */
export function evaluateOperationalAccount(
  account: OperationalAccountCandidate,
  scope: OperationalScope,
): EligibilityResult {
  if (account.orgId !== scope.orgId) {
    return { eligible: false, reason: "cross_org_account" };
  }
  if (scope.platform && account.platform !== scope.platform) {
    return { eligible: false, reason: "unsupported_platform" };
  }
  if (!account.clientId) {
    return { eligible: false, reason: "unlinked_account" };
  }
  if (account.status !== "active") {
    return { eligible: false, reason: "inactive_account" };
  }
  if (!account.clientOrgId) {
    return { eligible: false, reason: "missing_client" };
  }
  if (account.clientOrgId !== scope.orgId) {
    return { eligible: false, reason: "cross_org_client" };
  }
  if (account.clientArchivedAt !== null) {
    return { eligible: false, reason: "archived_client" };
  }
  if (scope.clientId && account.clientId !== scope.clientId) {
    return { eligible: false, reason: "client_mismatch" };
  }
  return { eligible: true };
}

export function filterOperationalAccounts<T extends OperationalAccountCandidate>(
  accounts: readonly T[],
  scope: OperationalScope,
): T[] {
  return accounts.filter((account) => evaluateOperationalAccount(account, scope).eligible);
}

