export const PERSONAL_GROUP_LABEL = "Contas pessoais";
export const HIDDEN_ACCOUNT_STATUS = "hidden";

const EXTERNAL_ID_PATTERN = /^act_[0-9]+$/;

export type GraphAdAccount = {
  id: string;
  name?: string | null;
  currency?: string | null;
  account_status?: number | null;
  business?: { id: string; name?: string | null } | null;
};

export type PanelAccountState = {
  externalId: string;
  status: string;
  clientName: string | null;
};

export type BusinessRef = { id: string; name: string };

export type DiscoveredAccount = {
  externalId: string;
  name: string;
  currency: string | null;
  accountStatus: number | null;
  inPanel: boolean;
  hidden: boolean;
  clientName: string | null;
};

export type AccountGroup = {
  business: BusinessRef | null;
  accounts: DiscoveredAccount[];
};

export function isMetaExternalId(value: string): boolean {
  return EXTERNAL_ID_PATTERN.test(value);
}

function compareText(a: string, b: string): number {
  return a.localeCompare(b, "pt-BR", { sensitivity: "base" });
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();
}

export function groupLabel(group: AccountGroup): string {
  return group.business ? group.business.name : PERSONAL_GROUP_LABEL;
}

function toBusiness(raw: GraphAdAccount["business"]): BusinessRef | null {
  if (!raw?.id) return null;
  const name = raw.name?.trim();
  return { id: raw.id, name: name || `Gerenciador ${raw.id}` };
}

function toDiscovered(raw: GraphAdAccount, state: PanelAccountState | undefined): DiscoveredAccount {
  const hidden = state?.status === HIDDEN_ACCOUNT_STATUS;
  return {
    externalId: raw.id,
    name: raw.name?.trim() || raw.id,
    currency: raw.currency || null,
    accountStatus: typeof raw.account_status === "number" ? raw.account_status : null,
    inPanel: Boolean(state) && !hidden,
    hidden,
    clientName: state?.clientName ?? null,
  };
}

function compareAccounts(a: DiscoveredAccount, b: DiscoveredAccount): number {
  return compareText(a.name, b.name) || compareText(a.externalId, b.externalId);
}

function compareGroups(a: AccountGroup, b: AccountGroup): number {
  if (!a.business || !b.business) return a.business ? -1 : b.business ? 1 : 0;
  return compareText(a.business.name, b.business.name) || compareText(a.business.id, b.business.id);
}

export function buildAccountGroups(
  accounts: readonly GraphAdAccount[],
  panel: readonly PanelAccountState[],
): AccountGroup[] {
  const panelById = new Map(panel.map((row) => [row.externalId, row]));
  const seen = new Set<string>();
  const groups = new Map<string, { business: BusinessRef | null; accounts: DiscoveredAccount[] }>();

  for (const raw of accounts) {
    if (!isMetaExternalId(raw.id) || seen.has(raw.id)) continue;
    seen.add(raw.id);
    const business = toBusiness(raw.business);
    const key = business ? `bm:${business.id}` : "personal";
    const existing = groups.get(key) ?? { business, accounts: [] };
    groups.set(key, { ...existing, accounts: [...existing.accounts, toDiscovered(raw, panelById.get(raw.id))] });
  }

  return [...groups.values()]
    .map((group) => ({ ...group, accounts: [...group.accounts].sort(compareAccounts) }))
    .sort(compareGroups);
}

function accountMatches(account: DiscoveredAccount, query: string): boolean {
  if (normalize(account.name).includes(query)) return true;
  const digits = query.replace(/^act_/, "");
  return digits.length > 0 && account.externalId.replace(/^act_/, "").includes(digits);
}

export function filterAccountGroups(groups: AccountGroup[], rawQuery: string): AccountGroup[] {
  const query = normalize(rawQuery);
  if (!query) return groups;
  return groups.flatMap((group) => {
    if (group.business && normalize(group.business.name).includes(query)) return [group];
    const accounts = group.accounts.filter((account) => accountMatches(account, query));
    return accounts.length > 0 ? [{ ...group, accounts }] : [];
  });
}

export function groupSummary(group: AccountGroup): { total: number; inPanel: number } {
  return {
    total: group.accounts.length,
    inPanel: group.accounts.filter((account) => account.inPanel).length,
  };
}

export function partitionRequestedIds(
  requested: readonly string[],
  visibleIds: Iterable<string>,
): { valid: string[]; unknown: string[] } {
  const visible = new Set(visibleIds);
  const unique = [...new Set(requested)];
  return {
    valid: unique.filter((id) => visible.has(id)),
    unknown: unique.filter((id) => !visible.has(id)),
  };
}
