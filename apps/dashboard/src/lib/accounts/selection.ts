export type SelectableAccount = {
  id: string;
  clientId: string;
  platform: string;
  isActive: boolean;
};

export type OperationalSelection = {
  clientId: string;
  platform: string;
  accountId: string;
};

/** Descarta IDs persistidos que não pertençam mais ao escopo operacional. */
export function resolveOperationalSelection(
  accounts: readonly SelectableAccount[],
  saved: OperationalSelection,
): OperationalSelection {
  const platforms = new Set(accounts.map((account) => account.platform));
  const platform = platforms.has(saved.platform) ? saved.platform : (accounts[0]?.platform ?? "meta");
  const accountsOnPlatform = accounts.filter(
    (account) => account.platform === platform && account.isActive,
  );
  const clientIds = new Set(accountsOnPlatform.map((account) => account.clientId));
  const clientId = clientIds.has(saved.clientId)
    ? saved.clientId
    : (accountsOnPlatform[0]?.clientId ?? "");
  const accountsForClient = accountsOnPlatform.filter((account) => account.clientId === clientId);
  const persistedAccount = accountsForClient.find((account) => account.id === saved.accountId);

  return {
    clientId,
    platform,
    accountId: persistedAccount?.id ?? accountsForClient[0]?.id ?? "",
  };
}

