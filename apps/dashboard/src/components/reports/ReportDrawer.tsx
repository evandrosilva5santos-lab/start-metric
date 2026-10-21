"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, RefreshCw, X } from "lucide-react";
import { Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ApiError, errorMessage, queryKeys, reportsApi } from "./api";
import { DeliveryForm } from "./DeliveryForm";
import { DeliveryPipeline } from "./DeliveryPipeline";
import { EMPTY, FREQUENCY_LABEL, REPORT_STATUS_LABEL, REPORT_STATUS_TONE, formatDateTime, scheduleSummary } from "./format";
import { RenderedRun } from "./RenderedRun";
import { RunHistory } from "./RunHistory";
import type { ReportListItem } from "./types";
import { useOverlay } from "./useOverlay";

interface ReportDrawerProps {
  report: ReportListItem;
  active: boolean;
  onClose: () => void;
  onEdit: (id: string) => void;
}

const HISTORY_LIMIT = 30;

function generateError(err: unknown): string {
  if (err instanceof ApiError && err.status === 409) return "Este relatório já foi gerado neste minuto. Aguarde um pouco e tente de novo.";
  return errorMessage(err);
}

export function ReportDrawer({ report, active, onClose, onEdit }: ReportDrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  useOverlay(active, panelRef, onClose);

  const runsQuery = useQuery({
    queryKey: queryKeys.runs(report.id),
    queryFn: () => reportsApi.runs(report.id, HISTORY_LIMIT),
    staleTime: 15_000,
  });
  const profileQuery = useQuery({ queryKey: queryKeys.profile, queryFn: reportsApi.profileId, staleTime: Infinity, retry: 0 });

  const generate = useMutation({
    mutationFn: () => reportsApi.generate(report.id),
    onSuccess: async (result) => {
      setSelectedRunId(result.run_id);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.runs(report.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.reportsAll }),
      ]);
    },
  });

  const runs = runsQuery.data ?? [];
  const run = runs.find((r) => r.id === selectedRunId) ?? runs[0] ?? null;
  const titleId = `report-drawer-${report.id}`;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div aria-hidden="true" onClick={onClose} className="absolute inset-0 bg-fg/30 animate-fade-in" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex h-full w-full flex-col bg-surface shadow-pop animate-slide-in sm:max-w-[560px] sm:border-l sm:border-border"
      >
        <header className="flex items-start gap-3 border-b border-border px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[13px] text-fg-muted">{report.client_name ?? EMPTY}</span>
            <h2 id={titleId} className="font-display text-[20px] font-semibold leading-[1.3] text-fg">
              {report.name}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-[13px] text-fg-muted">
              <Pill variant={REPORT_STATUS_TONE[report.status]}>{REPORT_STATUS_LABEL[report.status]}</Pill>
              <span className="tabular-nums">
                {FREQUENCY_LABEL[report.frequency]} · {scheduleSummary(report)}
              </span>
              <span className="tabular-nums">
                Próxima: {report.status === "active" ? formatDateTime(report.next_run_at) : EMPTY}
              </span>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar detalhe do relatório">
            <X className="size-5" aria-hidden="true" />
          </Button>
        </header>

        <div className="flex flex-wrap gap-2 border-b border-border px-4 py-3 sm:px-5">
          <Button variant="secondary" onClick={() => generate.mutate()} loading={generate.isPending}>
            <RefreshCw className="size-4" aria-hidden="true" />
            Gerar agora
          </Button>
          <Button variant="secondary" onClick={() => onEdit(report.id)}>
            <Pencil className="size-4" aria-hidden="true" />
            Editar
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-6">
            {generate.isError && (
              <p role="alert" className="rounded-control bg-danger-tint px-3 py-2 text-[13px] text-danger">
                {generateError(generate.error)}
              </p>
            )}
            {generate.isSuccess && generate.data.warnings.length > 0 && (
              <ul role="status" className="rounded-control bg-warning-tint px-3 py-2 text-[13px] text-warning">
                {generate.data.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}

            {runsQuery.isPending && <div className="h-40 animate-pulse rounded-panel bg-subtle" aria-label="Carregando gerações" />}
            {runsQuery.isError && (
              <div role="alert" className="flex flex-col items-start gap-2 rounded-control bg-danger-tint px-3 py-2 text-[13px] text-danger">
                <span>Não foi possível carregar as gerações: {errorMessage(runsQuery.error)}</span>
                <Button variant="secondary" size="sm" onClick={() => void runsQuery.refetch()}>Tentar de novo</Button>
              </div>
            )}

            {run && (
              <section aria-labelledby={`${titleId}-pipeline`} className="flex flex-col gap-4">
                <h3 id={`${titleId}-pipeline`} className="text-[14px] font-semibold text-fg">
                  Geração de {formatDateTime(run.scheduled_for, true)}
                </h3>
                <DeliveryPipeline run={run} profileId={profileQuery.data ?? null} />
                <DeliveryForm key={run.id} run={run} reportId={report.id} />
                {run.delivery_note && (
                  <p className="rounded-control border border-border bg-subtle px-3 py-2 text-[13px] text-fg">
                    <span className="font-medium">Comprovante: </span>
                    {run.delivery_note}
                  </p>
                )}
                <RenderedRun run={run} />
              </section>
            )}

            {runsQuery.isSuccess && (
              <section aria-labelledby={`${titleId}-history`} className="flex flex-col gap-2">
                <h3 id={`${titleId}-history`} className="text-[14px] font-semibold text-fg">Histórico de gerações</h3>
                <RunHistory runs={runs} selectedId={run?.id ?? null} onSelect={setSelectedRunId} />
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
