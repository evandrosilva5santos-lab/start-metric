"use client";

import { useCallback, useEffect, useMemo } from "react";
import { skipToken, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { useDashboardFilters } from "@/store/dashboard-filters";
import { resolveOperationalSelection } from "@/lib/accounts/selection";
import type { ClientRef, ContasResponse, DadosResponse, MetaAccount, MetaCampaign } from "@/lib/meta/dados-types";

async function readJson<T extends { error?: string }>(res: Response): Promise<T> {
  const json = (await res.json().catch(() => ({}))) as T;
  if (!res.ok || json.error) {
    throw new Error(json.error || `Falha ao carregar (${res.status})`);
  }
  return json;
}

const ACCOUNTS_KEY = ["meta", "contas"] as const;

export function clientOf(account: MetaAccount): string {
  return account.clientId;
}

export function useMetaAccounts() {
  const clientId = useDashboardFilters((s) => s.clientId);
  const platform = useDashboardFilters((s) => s.platform);
  const accountId = useDashboardFilters((s) => s.accountId);
  const setOperationalScope = useDashboardFilters((s) => s.setOperationalScope);

  const query = useQuery({
    queryKey: ACCOUNTS_KEY,
    queryFn: async ({ signal }) => {
      const json = await readJson<ContasResponse>(await fetch("/api/meta/contas", { signal }));
      return { contas: json.contas ?? [], clientes: json.clientes ?? [] };
    },
    staleTime: 5 * 60 * 1000,
  });

  const accounts: MetaAccount[] = useMemo(() => query.data?.contas ?? [], [query.data]);

  // O endpoint já devolve somente contas autorizadas; clientes sem conta não entram no seletor global.
  const clients: ClientRef[] = useMemo(() => {
    const withAccounts = new Set(
      accounts.filter((account) => account.platform === platform).map(clientOf),
    );
    return (query.data?.clientes ?? []).filter((client) => withAccounts.has(client.id));
  }, [accounts, platform, query.data]);

  const clientAccounts = useMemo(
    () => accounts.filter((account) => account.clientId === clientId && account.platform === platform),
    [accounts, clientId, platform],
  );

  // Cliente e conta sempre coerentes: conta salva manda no cliente; cliente
  // sem a conta salva cai na primeira conta ativa dele.
  useEffect(() => {
    if (!query.isSuccess) return;
    const next = resolveOperationalSelection(accounts, { clientId, platform, accountId });
    if (
      next.clientId !== clientId ||
      next.platform !== platform ||
      next.accountId !== accountId
    ) {
      setOperationalScope({
        clientId: next.clientId,
        platform: "meta",
        accountId: next.accountId,
      });
    }
  }, [accounts, accountId, clientId, platform, query.isSuccess, setOperationalScope]);

  return { ...query, accounts, clients, clientAccounts };
}

function dadosKey(clientId: string, platform: string, accountId: string, range: string): QueryKey {
  return ["meta", "dados", clientId, platform, accountId, range];
}

export function useMetaDados() {
  const accountId = useDashboardFilters((s) => s.accountId);
  const clientId = useDashboardFilters((s) => s.clientId);
  const platform = useDashboardFilters((s) => s.platform);
  const range = useDashboardFilters((s) => s.range);
  const liveInterval = useDashboardFilters((s) => s.liveInterval);
  const queryClient = useQueryClient();
  const key = useMemo(
    () => dadosKey(clientId, platform, accountId, range),
    [accountId, clientId, platform, range],
  );

  const query = useQuery({
    queryKey: key,
    queryFn: async ({ signal, queryKey }) => {
      // Aba escondida ou celular no bolso: não gasta cota da Meta à toa
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        const cached = queryClient.getQueryData<DadosResponse>(queryKey);
        if (cached) return cached;
      }
      // Primeira carga pode vir do cache do servidor; toda recarga depois
      // disso (ao vivo, botão atualizar, acordar) pede dados novos à Meta.
      const fresh = (queryClient.getQueryState(queryKey)?.dataUpdatedAt ?? 0) > 0;
      const params = new URLSearchParams({
        client_id: clientId,
        platform,
        account_id: accountId,
        range,
      });
      if (fresh) params.set("fresh", "true");
      return readJson<DadosResponse & { error?: string }>(
        await fetch(`/api/meta/dados?${params}`, { signal }),
      );
    },
    enabled: Boolean(clientId && platform && accountId),
    staleTime: 3 * 60 * 1000,
    // Atualiza sozinho enquanto aberto na frente da pessoa; para quando escondido
    refetchInterval: () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return false;
      }
      return liveInterval > 0 ? liveInterval * 1000 : false;
    },
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false, // Controlado com precisão pelo listener de acordar abaixo
    refetchOnReconnect: true,
    retry: 1,
    retryDelay: 1500,
  });

  // iPhone Standalone PWA / Tela de início e retorno de aba:
  // Ao reabrir ou tirar do bolso, o iOS acorda o app da memória sem recarregar a página.
  // Escutamos visibilitychange, pageshow, focus e online para buscar na hora.
  useEffect(() => {
    if (!clientId || !platform || !accountId) return;

    let lastWakeAttempt = 0;

    const handleWake = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      const now = Date.now();
      const state = queryClient.getQueryState(key);
      const updatedAt = state?.dataUpdatedAt ?? 0;
      const elapsedSinceUpdate = now - updatedAt;
      const elapsedSinceLastAttempt = now - lastWakeAttempt;

      // Se passou mais de 10s da última busca e não houve tentativa recente, atualiza na hora
      if (elapsedSinceUpdate > 10_000 && elapsedSinceLastAttempt > 4_000) {
        lastWakeAttempt = now;
        void queryClient.refetchQueries({ queryKey: key, exact: true });
      }
    };

    document.addEventListener("visibilitychange", handleWake);
    window.addEventListener("pageshow", handleWake);
    window.addEventListener("focus", handleWake);
    window.addEventListener("online", handleWake);

    return () => {
      document.removeEventListener("visibilitychange", handleWake);
      window.removeEventListener("pageshow", handleWake);
      window.removeEventListener("focus", handleWake);
      window.removeEventListener("online", handleWake);
    };
  }, [accountId, clientId, key, platform, queryClient]);

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

  return { ...query, refresh, updateCampaign, hasAccount: Boolean(clientId && platform && accountId) };
}

/** Quantos avisos pedem ação, lido do que já foi carregado (não busca nada). */
export function useDiagnosticCount(): number {
  const accountId = useDashboardFilters((s) => s.accountId);
  const clientId = useDashboardFilters((s) => s.clientId);
  const platform = useDashboardFilters((s) => s.platform);
  const range = useDashboardFilters((s) => s.range);
  const { data } = useQuery<DadosResponse>({
    queryKey: dadosKey(clientId, platform, accountId, range),
    queryFn: skipToken,
  });
  return data?.avisos.filter((a) => a.tipo === "alerta" || a.tipo === "atencao").length ?? 0;
}
