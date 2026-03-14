"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AlertRuleInput, AlertRow, NotificationRuleRow } from "@/lib/alerts/types";

const ALERTS_KEY = ["alerts-unread"] as const;
const RULES_KEY = ["alert-rules"] as const;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: "Erro desconhecido" }));
    throw new Error((body as { error?: string }).error ?? `HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function useAlerts() {
  const queryClient = useQueryClient();

  // ─── Queries ────────────────────────────────────────────────
  const alertsQuery = useQuery({
    queryKey: ALERTS_KEY,
    queryFn: () => fetchJson<AlertRow[]>("/api/alerts?status=unread&limit=50"),
    refetchInterval: 60_000, // poll a cada 60s
    staleTime: 30_000,
  });

  const rulesQuery = useQuery({
    queryKey: RULES_KEY,
    queryFn: () => fetchJson<NotificationRuleRow[]>("/api/alerts/rules"),
    staleTime: 60_000,
  });

  // ─── Mutations ──────────────────────────────────────────────
  const markReadMutation = useMutation({
    mutationFn: (alertId: string) =>
      fetchJson(`/api/alerts/${alertId}/read`, { method: "POST" }),
    onMutate: async (alertId) => {
      await queryClient.cancelQueries({ queryKey: ALERTS_KEY });
      const previous = queryClient.getQueryData<AlertRow[]>(ALERTS_KEY);
      queryClient.setQueryData<AlertRow[]>(ALERTS_KEY, (old) =>
        (old ?? []).filter((a) => a.id !== alertId),
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(ALERTS_KEY, ctx.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ALERTS_KEY });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const alerts = alertsQuery.data ?? [];
      await Promise.allSettled(
        alerts.map((a) => fetchJson(`/api/alerts/${a.id}/read`, { method: "POST" })),
      );
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ALERTS_KEY });
      const previous = queryClient.getQueryData<AlertRow[]>(ALERTS_KEY);
      queryClient.setQueryData<AlertRow[]>(ALERTS_KEY, () => []);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(ALERTS_KEY, ctx.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ALERTS_KEY });
    },
  });

  const createRuleMutation = useMutation({
    mutationFn: (payload: AlertRuleInput) =>
      fetchJson("/api/alerts/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: RULES_KEY });
    },
  });

  const toggleRuleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      fetchJson(`/api/alerts/rules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      }),
    onMutate: async ({ id, active }) => {
      await queryClient.cancelQueries({ queryKey: RULES_KEY });
      const previous = queryClient.getQueryData<NotificationRuleRow[]>(RULES_KEY);
      queryClient.setQueryData<NotificationRuleRow[]>(RULES_KEY, (old) =>
        (old ?? []).map((r) => (r.id === id ? { ...r, active } : r)),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(RULES_KEY, ctx.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: RULES_KEY });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/api/alerts/rules/${id}`, { method: "DELETE" }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: RULES_KEY });
      const previous = queryClient.getQueryData<NotificationRuleRow[]>(RULES_KEY);
      queryClient.setQueryData<NotificationRuleRow[]>(RULES_KEY, (old) =>
        (old ?? []).filter((r) => r.id !== id),
      );
      return { previous };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(RULES_KEY, ctx.previous);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: RULES_KEY });
    },
  });

  // ─── Derivados ──────────────────────────────────────────────
  const unreadAlerts = alertsQuery.data ?? [];
  const unreadCount = unreadAlerts.length;
  const latestAlert = unreadAlerts[0] ?? null;
  const rules = rulesQuery.data ?? [];
  const activeRulesCount = rules.filter((r) => r.active).length;

  return {
    // Queries
    alertsQuery,
    rulesQuery,
    // Dados derivados
    unreadAlerts,
    unreadCount,
    latestAlert,
    rules,
    activeRulesCount,
    // Mutations
    markRead: markReadMutation.mutate,
    markReadAsync: markReadMutation.mutateAsync,
    isMarkingRead: markReadMutation.isPending,
    markAllRead: markAllReadMutation.mutate,
    isMarkingAllRead: markAllReadMutation.isPending,
    createRule: createRuleMutation.mutateAsync,
    isCreatingRule: createRuleMutation.isPending,
    toggleRule: toggleRuleMutation.mutate,
    isTogglingRule: toggleRuleMutation.isPending,
    deleteRule: deleteRuleMutation.mutate,
    isDeletingRule: deleteRuleMutation.isPending,
  };
}
