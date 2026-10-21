import type { AccountGroup } from "@/lib/meta/account-groups";

export type CandidateAccount = {
  id: string;
  name: string;
  currency: string;
  isActive: boolean;
  clientId: string | null;
  clientName: string | null;
  hidden?: boolean;
};

export type ClientMetaAccounts = {
  contas: CandidateAccount[];
  grupos: AccountGroup[];
};

type CandidatesResponse = Partial<ClientMetaAccounts> & {
  error?: string;
  code?: string;
};

export class ApiError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
  }
}

export const clientMetaAccountsKey = (clientId: string) => ["client-meta-accounts", clientId] as const;

export async function saveClientAccounts(clientId: string, externalIds: string[], confirmReassignment = false) {
  const res = await fetch(`/api/clients/${clientId}/accounts`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      external_ids: externalIds,
      confirm_reassignment: confirmReassignment,
    }),
  });
  const json = (await res.json().catch(() => ({}))) as CandidatesResponse;
  if (!res.ok) throw new ApiError(json.error || "Não deu para salvar as contas.", json.code);
}

export async function fetchClientMetaAccounts(clientId: string, signal?: AbortSignal): Promise<ClientMetaAccounts> {
  const res = await fetch(`/api/clients/${clientId}/meta-accounts`, { signal });
  const json = (await res.json().catch(() => ({}))) as CandidatesResponse;
  if (!res.ok) throw new ApiError(json.error || "Não deu para buscar as contas.", json.code);
  return { contas: json.contas ?? [], grupos: json.grupos ?? [] };
}
