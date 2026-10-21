"use client";

import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAlertAssignees, useTriageAlerts } from "@/hooks/useAlertTriage";
import { parseTriageQuery, triageQuerySchema, type TriageQuery } from "@/lib/alerts/schemas";
import type { AlertTriageItem } from "@/lib/alerts/types";
import { formatDateTimeBr } from "@/lib/alerts/present";
import { AlertDetailPanel } from "./AlertDetailPanel";
import { TriageFilters } from "./TriageFilters";
import { TriageList, TriageListSkeleton } from "./TriageList";

const DEFAULT_QUERY = triageQuerySchema.parse({});

const EMPTY_COPY: Record<TriageQuery["state"], string> = {
  open: "Nenhum alerta aberto com estes filtros.",
  acknowledged: "Nenhum alerta reconhecido aguardando resolução.",
  resolved: "Nenhum alerta resolvido com estes filtros.",
  all: "Nenhum alerta com estes filtros.",
};

function buildSearch(query: TriageQuery, alerta: string | null): string {
  const params = new URLSearchParams();
  if (query.state !== DEFAULT_QUERY.state) params.set("state", query.state);
  if (query.severity !== DEFAULT_QUERY.severity) params.set("severity", query.severity);
  if (query.assigned_to !== DEFAULT_QUERY.assigned_to) params.set("assigned_to", query.assigned_to);
  if (query.page > 1) params.set("page", String(query.page));
  if (query.limit !== DEFAULT_QUERY.limit) params.set("limit", String(query.limit));
  if (alerta) params.set("alerta", alerta);
  const search = params.toString();
  return search ? `?${search}` : "";
}

export function AlertsTriage() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const parsed = parseTriageQuery(new URLSearchParams(searchParams.toString()));
  const query = parsed.success ? parsed.data : DEFAULT_QUERY;
  const selectedId = searchParams.get("alerta");

  const [snapshot, setSnapshot] = useState<AlertTriageItem | null>(null);
  const alerts = useTriageAlerts(query);
  const team = useAlertAssignees();
  const meId = team.data?.me ?? null;
  const assignees = team.data?.assignees ?? [];

  const navigate = (next: Partial<TriageQuery>, alerta: string | null) => {
    const merged = { ...query, ...next };
    window.history.replaceState(null, "", `${pathname}${buildSearch(merged, alerta)}`);
  };

  const assigneeName = (id: string | null | undefined): string => {
    if (!id) return "—";
    if (id === meId) return "Você";
    return assignees.find((person) => person.id === id)?.name ?? "Pessoa da equipe";
  };

  const page = alerts.data;
  const items = page?.items ?? [];
  const selected =
    snapshot && snapshot.id === selectedId ? snapshot : (items.find((item) => item.id === selectedId) ?? null);
  const firstRow = page && page.total > 0 ? (page.page - 1) * page.limit + 1 : 0;
  const lastRow = items.length > 0 ? firstRow + items.length - 1 : 0;

  const closePanel = () => {
    const returnTo = selectedId;
    navigate({}, null);
    if (returnTo) requestAnimationFrame(() => document.getElementById(`alerta-${returnTo}`)?.focus());
  };

  return (
    <section aria-label="Triagem de alertas" className="flex flex-col gap-4">
      <TriageFilters
        query={query}
        assignees={assignees}
        meId={meId}
        onChange={(next) => navigate({ ...next, page: 1 }, selectedId)}
      />

      {!parsed.success && (
        <p role="status" className="text-[13px] text-fg-muted">
          Um dos filtros do link não era válido; mostrando os alertas abertos.
        </p>
      )}

      <div className={selected ? "grid gap-4 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start" : "grid gap-4"}>
        <div className="flex min-w-0 flex-col gap-3">
          {alerts.isPending ? (
            <TriageListSkeleton />
          ) : alerts.isError ? (
            <div role="alert" className="flex flex-col gap-3 rounded-panel border border-border border-l-[3px] border-l-danger bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2">
                <AlertTriangle size={18} className="mt-0.5 shrink-0 text-danger" aria-hidden="true" />
                <div className="flex flex-col gap-0.5">
                  <p className="text-[14px] font-medium text-fg">Não deu para carregar os alertas.</p>
                  <p className="text-[13px] text-fg-muted">
                    {alerts.error.message} · tentativa às {formatDateTimeBr(new Date(alerts.errorUpdatedAt).toISOString())}
                  </p>
                </div>
              </div>
              <Button variant="secondary" onClick={() => alerts.refetch()}>
                <RefreshCw size={16} aria-hidden="true" />
                Tentar de novo
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-panel border border-dashed border-border-strong bg-surface p-6 text-center">
              <p className="text-[14px] font-medium text-fg">{EMPTY_COPY[query.state]}</p>
              <p className="mt-1 text-[13px] text-fg-muted">
                Os alertas aparecem aqui quando uma regra ativa dispara. Confira as regras na aba Regras.
              </p>
            </div>
          ) : (
            <>
              <TriageList
                items={items}
                selectedId={selectedId}
                assigneeName={assigneeName}
                onSelect={(id) => {
                  setSnapshot(null);
                  navigate({}, id);
                }}
              />
              <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-fg-muted">
                <p className="num" aria-live="polite">
                  {firstRow}–{lastRow} de {page?.total ?? 0}
                  {alerts.isFetching ? " · atualizando…" : ""}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={query.page <= 1}
                    onClick={() => navigate({ page: query.page - 1 }, null)}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={!page?.hasMore}
                    onClick={() => navigate({ page: query.page + 1 }, null)}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {selected && (
          <AlertDetailPanel
            key={selected.id}
            item={selected}
            assignees={assignees}
            meId={meId}
            assigneeName={assigneeName}
            onUpdated={setSnapshot}
            onClose={closePanel}
          />
        )}
      </div>
    </section>
  );
}
