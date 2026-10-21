"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorAlert } from "@/components/ui/ErrorAlert";
import { Skeleton } from "@/components/ui/Skeleton";
import { errorMessage, queryKeys, reportsApi } from "@/components/reports/api";
import { ReportEditor } from "@/components/reports/editor/ReportEditor";
import { STATE_FILTERS, compareByUrgency, parseStateFilter, reportState, type StateFilter } from "@/components/reports/format";
import { ReportDrawer } from "@/components/reports/ReportDrawer";
import { ReportsFilters } from "@/components/reports/ReportsFilters";
import { ReportsList } from "@/components/reports/ReportsList";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CLOCK_TICK_MS = 60_000;

type EditorTarget = { reportId: string | null } | null;

function uuidParam(value: string | null): string | null {
  return value && UUID.test(value) ? value : null;
}

export function ReportsClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const clientId = uuidParam(searchParams.get("cliente"));
  const stateFilter = parseStateFilter(searchParams.get("estado"));
  const openId = uuidParam(searchParams.get("relatorio"));

  const [now, setNow] = useState(() => Date.now());
  const [editor, setEditor] = useState<EditorTarget>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const reportsQuery = useQuery({
    queryKey: queryKeys.reports(clientId),
    queryFn: () => reportsApi.list(clientId),
    staleTime: 30_000,
  });
  const clientsQuery = useQuery({ queryKey: queryKeys.clients, queryFn: reportsApi.clients, staleTime: 5 * 60_000 });
  const clientsState = clientsQuery.isPending ? "loading" : clientsQuery.isError ? "error" : "ready";

  const setParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const reports = useMemo(() => reportsQuery.data ?? [], [reportsQuery.data]);
  const states = useMemo(() => reports.map((r) => reportState(r, now)), [reports, now]);
  const visible = useMemo(() => {
    const filter = STATE_FILTERS.find((f) => f.value === stateFilter);
    const matching = filter ? reports.filter((r, i) => filter.match(states[i])) : reports;
    return [...matching].sort(compareByUrgency(now));
  }, [reports, states, stateFilter, now]);

  const openReport = reports.find((r) => r.id === openId) ?? null;
  const closeDrawer = useCallback(() => setParams({ relatorio: null }), [setParams]);
  const hasFilters = clientId !== null || stateFilter !== null;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[20px] font-semibold leading-[1.3] text-fg">Devidos e atrasados</h1>
          <p className="max-w-2xl text-[14px] text-fg-muted">
            Todo relatório devido precisa passar por gerado, enviado, recebido e aprovado. Copiar o texto não conta como envio.
          </p>
        </div>
        <Button onClick={() => setEditor({ reportId: null })} className="shrink-0 self-start sm:self-auto">
          <Plus className="size-4" aria-hidden="true" />
          Novo relatório
        </Button>
      </div>

      <ReportsFilters
        clients={clientsQuery.data ?? []}
        clientId={clientId}
        state={stateFilter}
        states={states}
        onClientChange={(id) => setParams({ cliente: id })}
        onStateChange={(value: StateFilter | null) => setParams({ estado: value })}
      />

      {reportsQuery.isPending && (
        <div className="flex flex-col gap-2" aria-busy="true" aria-label="Carregando relatórios">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-panel" />
          ))}
        </div>
      )}

      {reportsQuery.isError && (
        <div className="flex flex-col items-start gap-3">
          <ErrorAlert message={`Não foi possível carregar os relatórios: ${errorMessage(reportsQuery.error)}`} />
          <Button variant="secondary" onClick={() => void reportsQuery.refetch()}>Tentar de novo</Button>
        </div>
      )}

      {reportsQuery.isSuccess && reports.length === 0 && !hasFilters && (
        <EmptyState
          icon={FileText}
          title="Nenhum relatório ainda"
          description="Crie o primeiro relatório: escolha o cliente, monte o texto com variáveis e defina quando ele deve ser gerado."
          action={{ label: "Criar primeiro relatório", onClick: () => setEditor({ reportId: null }) }}
        />
      )}

      {reportsQuery.isSuccess && visible.length === 0 && (reports.length > 0 || hasFilters) && (
        <div className="flex flex-col items-start gap-2 rounded-panel border border-dashed border-border-strong p-5">
          <p className="text-[14px] text-fg">Nenhum relatório com esses filtros.</p>
          <Button variant="secondary" size="sm" onClick={() => setParams({ cliente: null, estado: null })}>Limpar filtros</Button>
        </div>
      )}

      {visible.length > 0 && (
        <ReportsList
          reports={visible}
          now={now}
          selectedId={openId}
          onOpen={(id) => setParams({ relatorio: id })}
          onEdit={(id) => setEditor({ reportId: id })}
        />
      )}

      {openReport && (
        <ReportDrawer
          key={openReport.id}
          report={openReport}
          active={editor === null}
          onClose={closeDrawer}
          onEdit={(id) => setEditor({ reportId: id })}
        />
      )}

      {editor && (
        <ReportEditor
          reportId={editor.reportId}
          defaultClientId={clientId}
          clients={clientsQuery.data ?? []}
          clientsState={clientsState}
          onClose={() => setEditor(null)}
          onSaved={(id) => {
            setEditor(null);
            setParams({ relatorio: id });
          }}
          onDeleted={() => {
            setEditor(null);
            setParams({ relatorio: null });
          }}
        />
      )}
    </div>
  );
}
