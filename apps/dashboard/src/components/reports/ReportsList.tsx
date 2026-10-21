"use client";

import { ChevronRight, Pencil } from "lucide-react";
import { Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  EMPTY,
  FREQUENCY_LABEL,
  REPORT_STATUS_LABEL,
  REPORT_STATUS_TONE,
  RUN_STATUS_LABEL,
  RUN_STATUS_TONE,
  formatDateTime,
  isOverdue,
  scheduleSummary,
} from "./format";
import type { ReportListItem } from "./types";

interface ReportsListProps {
  reports: ReportListItem[];
  now: number;
  selectedId: string | null;
  onOpen: (id: string) => void;
  onEdit: (id: string) => void;
}

function LastRunCell({ report, now }: { report: ReportListItem; now: number }) {
  const run = report.latest_run;
  const overdue = isOverdue(report, now);
  return (
    <div className="flex flex-col items-start gap-1">
      {overdue && <Pill variant="bad">Atrasado</Pill>}
      {run ? (
        <>
          {!overdue && <Pill variant={RUN_STATUS_TONE[run.status]}>{RUN_STATUS_LABEL[run.status]}</Pill>}
          <span className="text-[12px] text-fg-muted tabular-nums">
            {overdue ? `Última: ${RUN_STATUS_LABEL[run.status].toLowerCase()} em ` : ""}
            {formatDateTime(run.scheduled_for)}
          </span>
        </>
      ) : (
        <span className="text-[13px] text-fg-muted">
          <span aria-hidden="true">{EMPTY} </span>nunca gerado
        </span>
      )}
    </div>
  );
}

function NameCell({ report, onOpen }: { report: ReportListItem; onOpen: (id: string) => void }) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpen(report.id);
        }}
        className="min-h-11 max-w-full truncate rounded-sm text-left font-medium text-fg underline-offset-2 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-h-0"
      >
        {report.name}
      </button>
      {report.status !== "active" && (
        <Pill variant={REPORT_STATUS_TONE[report.status]}>{REPORT_STATUS_LABEL[report.status]}</Pill>
      )}
    </div>
  );
}

function NextRun({ report }: { report: ReportListItem }) {
  if (report.status !== "active" || !report.next_run_at) {
    return <span className="text-fg-muted">{EMPTY}</span>;
  }
  return <span className="tabular-nums">{formatDateTime(report.next_run_at)}</span>;
}

export function ReportsList({ reports, now, selectedId, onOpen, onEdit }: ReportsListProps) {
  return (
    <>
      <div className="hidden overflow-x-auto rounded-panel border border-border bg-surface shadow-card md:block">
        <table className="w-full min-w-[760px] border-collapse text-[13px]">
          <caption className="sr-only">Relatórios devidos e atrasados, do mais urgente ao menos urgente</caption>
          <thead>
            <tr className="border-b border-border text-left text-[12px] font-medium text-fg-muted">
              <th scope="col" className="px-4 py-2.5 font-medium">Cliente</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Relatório</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Frequência</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Próxima geração</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Última geração</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr
                key={report.id}
                onClick={() => onOpen(report.id)}
                aria-current={selectedId === report.id ? "true" : undefined}
                className={cn(
                  "cursor-pointer border-b border-border align-top transition-colors last:border-0 hover:bg-subtle",
                  selectedId === report.id && "bg-primary-tint hover:bg-primary-tint",
                )}
              >
                <td className="max-w-[200px] truncate px-4 py-3 text-fg">{report.client_name ?? EMPTY}</td>
                <td className="max-w-[280px] px-4 py-2">
                  <NameCell report={report} onOpen={onOpen} />
                </td>
                <td className="px-4 py-3">
                  <span className="text-fg">{FREQUENCY_LABEL[report.frequency]}</span>
                  <span className="block text-[12px] text-fg-muted tabular-nums">{scheduleSummary(report)}</span>
                </td>
                <td className="px-4 py-3">
                  <NextRun report={report} />
                </td>
                <td className="px-4 py-3">
                  <LastRunCell report={report} now={now} />
                </td>
                <td className="px-4 py-2 text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Editar ${report.name}`}
                    title="Editar"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(report.id);
                    }}
                  >
                    <Pencil className="size-4" aria-hidden="true" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-2 md:hidden" aria-label="Relatórios devidos e atrasados">
        {reports.map((report) => (
          <li key={report.id}>
            <button
              type="button"
              onClick={() => onOpen(report.id)}
              className="flex min-h-11 w-full items-start gap-3 rounded-panel border border-border bg-surface p-3.5 text-left shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="text-[12px] text-fg-muted">{report.client_name ?? EMPTY}</span>
                <span className="truncate font-medium text-fg">{report.name}</span>
                <span className="text-[12px] text-fg-muted tabular-nums">
                  {FREQUENCY_LABEL[report.frequency]} · próxima <NextRun report={report} />
                </span>
                <LastRunCell report={report} now={now} />
              </div>
              <ChevronRight className="mt-1 size-4 shrink-0 text-fg-muted" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
