"use client";

import { useCallback, useEffect, useMemo } from "react";
import { skipToken, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { NO_CLIENT, useDashboardFilters } from "@/store/dashboard-filters";
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
  return account.clientId ?? NO_CLIENT;
}

export function useMetaAccounts() {
  const clientId = useDashboardFilters((s) => s.clientId);
  const accountId = useDashboardFilters((s) => s.accountId);
  const setClientId = useDashboardFilters((s) => s.setClientId);
  const setAccountId = useDashboardFilters((s) => s.setAccountId);

  const query = useQuery({
    queryKey: ACCOUNTS_KEY,
    queryFn: async ({ signal }) => {
      const json = await readJson<ContasResponse>(await fetch("/api/meta/contas", { signal }));
      return { contas: json.contas ?? [], clientes: json.clientes ?? [] };
    },
    staleTime: 5 * 60 * 1000,
  });

  const accounts: MetaAccount[] = useMemo(() => query.data?.contas ?? [], [query.data]);

  // Só clientes com pelo menos uma conta, mais "Sem cliente" quando houver contas soltas.
  const clients: ClientRef[] = useMemo(() => {
    const withAccounts = new Set(accounts.map(clientOf));
    const list = (query.data?.clientes ?? []).filter((c) => withAccounts.has(c.id));
    if (withAccounts.has(NO_CLIENT)) list.push({ id: NO_CLIENT, name: "Sem cliente" });
    return list;
  }, [accounts, query.data]);

  const clientAccounts = useMemo(
    () => accounts.filter((a) => clientOf(a) === clientId),
    [accounts, clientId],
  );

  // Cliente e conta sempre coerentes: conta salva manda no cliente; cliente
  // sem a conta salva cai na primeira conta ativa dele.
  useEffect(() => {
    if (accounts.length === 0) return;
    const saved = accounts.find((a) => a.id === accountId);
    if (saved && clientOf(saved) === clientId) return;
    if (saved && !clientId) {
      setClientId(clientOf(saved));
      return;
    }
    const clientValid = clients.some((c) => c.id === clientId);
    const targetClient = clientValid ? clientId : (clients[0]?.id ?? NO_CLIENT);
    const pool = accounts.filter((a) => clientOf(a) === targetClient);
    const next = pool.find((a) => a.isActive) ?? pool[0];
    if (targetClient !== clientId) setClientId(targetClient);
    if (next && next.id !== accountId) setAccountId(next.id);
  }, [accounts, clients, accountId, clientId, setAccountId, setClientId]);

  return { ...query, accounts, clients, clientAccounts };
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
      // Aba escondida ou celular no bolso: não gasta cota da Meta à toa
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        const cached = queryClient.getQueryData<DadosResponse>(queryKey);
        if (cached) return cached;
      }
      // Primeira carga pode vir do cache do servidor; toda recarga depois
      // disso (ao vivo, botão atualizar, acordar) pede dados novos à Meta.
      const fresh = (queryClient.getQueryState(queryKey)?.dataUpdatedAt ?? 0) > 0;
      const params = new URLSearchParams({ account_id: accountId, range });
      if (fresh) params.set("fresh", "true");
      return readJson<DadosResponse & { error?: string }>(
        await fetch(`/api/meta/dados?${params}`, { signal }),
      );
    },
    enabled: Boolean(accountId),
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
    if (!accountId) return;

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
  }, [accountId, key, queryClient]);

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
