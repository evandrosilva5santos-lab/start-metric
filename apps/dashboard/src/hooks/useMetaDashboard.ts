"use client";

import { useCallback, useEffect, useMemo } from "react";
import { skipToken, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useDashboardFilters } from "@/store/dashboard-filters";
import type { ContasResponse, DadosResponse, MetaAccount, MetaCampaign } from "@/lib/meta/dados-types";

async function readJson<T extends { error?: string }>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => ({}))) as T;
  if (!res.ok || json.error) {
    throw new Error(json.error || `Falha ao carregar (${res.status})`);
  }
  return json;
}

const ACCOUNTS_KEY = ["meta", "contas"] as const;

export function useMetaAccounts() {
  const accountId = useDashboardFilters((s) => s.accountId);
  const setAccountId = useDashboardFilters((s) => s.setAccountId);

  const query = useQuery({
    queryKey: ACCOUNTS_KEY,
    queryFn: async ({ signal }) => {
      const json = await readJson<ContasResponse>(await fetch("/api/meta/contas", { signal }));
      return json.contas ?? [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const accounts: MetaAccount[] = useMemo(() => query.data ?? [], [query.data]);

  // Conta salva que sumiu da lista (ou nenhuma escolhida): usa a primeira ativa.
  useEffect(() => {
    if (accounts.length === 0) return;
    if (accountId && accounts.some((a) => a.id === accountId)) return;
    const fallback = accounts.find((a) => a.isActive) ?? accounts[0];
    setAccountId(fallback.id);
  }, [accounts, accountId, setAccountId]);

  return { ...query, accounts };
}

function dadosKey(accountId: string, range: string): QueryKey {
  return ["meta", "dados", accountId, range];
}

export function useMetaDados() {
  const accountId = useDashboardFilters((s) => s.accountId);
  const range = useDashboardFilters((s) => s.range);
  const liveInterval = useDashboardFilters((s) => s.liveInterval);
  const queryClient = useQueryClient();
  const key = useMemo(() => dadosKey(accountId, range), [accountId, range]);

  const query = useQuery({
    queryKey: key,
    queryFn: async ({ signal, queryKey }) => {
      // Primeira carga pode vir do cache do servidor; toda recarga depois
      // disso (ao vivo, botão atualizar) pede dados novos à Meta.
      const fresh = (queryClient.getQueryState(queryKey)?.dataUpdatedAt ?? 0) > 0;
      const params = new URLSearchParams({ account_id: accountId, range });
      if (fresh) params.set("fresh", "true");
      return readJson<DadosResponse & { error?: string }>(
        await fetch(`/api/meta/dados?${params}`, { signal }),
      );
    },
    enabled: Boolean(accountId),
    staleTime: 3 * 60 * 1000,
    refetchInterval: liveInterval > 0 ? liveInterval * 1000 : false,
    // Aba escondida não gasta cota da Meta; ao voltar, atualiza na hora.
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: liveInterval > 0,
  });

  const refresh = useCallback(
    () => queryClient.refetchQueries({ queryKey: key, exact: true }),
    [queryClient, key],
  );

  const updateCampaign = useCallback(
    (campaignId: string, patch: Partial<MetaCampaign>) => {
      queryClient.setQueryData<DadosResponse>(key, (current) =>
        current
          ? {
              ...current,
              campanhas: current.campanhas.map((c) => (c.id === campaignId ? { ...c, ...patch } : c)),
            }
          : current,
      );
    },
    [queryClient, key],
  );

  return { ...query, refresh, updateCampaign, hasAccount: Boolean(accountId) };
}

/** Quantos avisos pedem ação, lido do que já foi carregado (não busca nada). */
export function useDiagnosticCount(): number {
  const accountId = useDashboardFilters((s) => s.accountId);
  const range = useDashboardFilters((s) => s.range);
  const { data } = useQuery<DadosResponse>({ queryKey: dadosKey(accountId, range), queryFn: skipToken });
  return data?.avisos.filter((a) => a.tipo === "alerta" || a.tipo === "atencao").length ?? 0;
}
