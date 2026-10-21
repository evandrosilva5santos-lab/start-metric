"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TriageQuery } from "@/lib/alerts/schemas";
import type {
  AlertAssignee,
  AlertRuleInput,
  AlertTriageItem,
  AlertTriagePage,
  NotificationRuleRow,
} from "@/lib/alerts/types";

const TRIAGE_KEY = "alerts-triage";
const LEGACY_ALERTS_KEY = ["alerts-unread"] as const;
const ASSIGNEES_KEY = ["alert-assignees"] as const;
const RULES_KEY = ["alert-rules"] as const;

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Erro ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function triageUrl(query: TriageQuery): string {
  const params = new URLSearchParams({
    view: "triage",
    state: query.state,
    severity: query.severity,
    assigned_to: query.assigned_to,
    page: String(query.page),
    limit: String(query.limit),
  });
  return `/api/alerts?${params.toString()}`;
}

export function useTriageAlerts(query: TriageQuery) {
  return useQuery({
    queryKey: [TRIAGE_KEY, query],
    queryFn: () => fetchJson<AlertTriagePage>(triageUrl(query)),
    refetchInterval: 60_000,
    staleTime: 15_000,
    placeholderData: (previous) => previous,
  });
}

export function useAlertAssignees() {
  return useQuery({
    queryKey: ASSIGNEES_KEY,
    queryFn: () => fetchJson<{ me: string; assignees: AlertAssignee[] }>("/api/alerts/assignees"),
    staleTime: 5 * 60_000,
  });
}

type TriageMutation =
  | { kind: "acknowledge"; id: string }
  | { kind: "resolve"; id: string; note: string }
  | { kind: "assign"; id: string; assignedTo: string | null };

function mutationRequest(input: TriageMutation): [string, RequestInit] {
  if (input.kind === "acknowledge") return [`/api/alerts/${input.id}/acknowledge`, { method: "POST" }];
  if (input.kind === "resolve") {
    return [`/api/alerts/${input.id}/resolve`, { method: "POST", body: JSON.stringify({ note: input.note }) }];
  }
  return [`/api/alerts/${input.id}`, { method: "PATCH", body: JSON.stringify({ assigned_to: input.assignedTo }) }];
}

export function useTriageMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TriageMutation) => {
      const [url, init] = mutationRequest(input);
      return fetchJson<AlertTriageItem>(url, init);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [TRIAGE_KEY] });
      queryClient.invalidateQueries({ queryKey: LEGACY_ALERTS_KEY });
    },
  });
}

export function useAlertRules() {
  const queryClient = useQueryClient();
  const rulesQuery = useQuery({
    queryKey: RULES_KEY,
    queryFn: () => fetchJson<NotificationRuleRow[]>("/api/alerts/rules"),
    staleTime: 60_000,
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: RULES_KEY });

  const create = useMutation({
    mutationFn: (payload: AlertRuleInput) =>
      fetchJson<NotificationRuleRow>("/api/alerts/rules", { method: "POST", body: JSON.stringify(payload) }),
    onSuccess: invalidate,
  });
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      fetchJson<NotificationRuleRow>(`/api/alerts/rules/${id}`, { method: "PATCH", body: JSON.stringify({ active }) }),
    onSettled: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => fetchJson<{ ok: true }>(`/api/alerts/rules/${id}`, { method: "DELETE" }),
    onSettled: invalidate,
  });

  return { rulesQuery, create, toggle, remove };
}
