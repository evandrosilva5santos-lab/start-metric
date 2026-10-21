import { Pill } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { RUN_STATUS_LABEL, RUN_STATUS_TONE, formatDateTime } from "./format";
import type { ReportRun } from "./types";

interface RunHistoryProps {
  runs: ReportRun[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function stepSummary(run: ReportRun): string {
  if (run.approved_at) return `aprovado ${formatDateTime(run.approved_at)}`;
  if (run.received_at) return `recebido ${formatDateTime(run.received_at)}`;
  if (run.sent_at) return `enviado ${formatDateTime(run.sent_at)}`;
  if (run.error_message) return run.error_message;
  return "sem envio registrado";
}

export function RunHistory({ runs, selectedId, onSelect }: RunHistoryProps) {
  if (runs.length === 0) {
    return <p className="text-[13px] text-fg-muted">Nenhuma geração ainda. Use “Gerar agora” para criar a primeira.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-border rounded-panel border border-border">
      {runs.map((run) => {
        const selected = run.id === selectedId;
        const missing = run.missing_variables.length;
        return (
          <li key={run.id}>
            <button
              type="button"
              onClick={() => onSelect(run.id)}
              aria-pressed={selected}
              className={cn(
                "flex min-h-11 w-full flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-left transition-colors hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                selected && "bg-primary-tint hover:bg-primary-tint",
              )}
            >
              <span className="w-[92px] shrink-0 text-[13px] text-fg tabular-nums">{formatDateTime(run.scheduled_for)}</span>
              <Pill variant={RUN_STATUS_TONE[run.status]}>{RUN_STATUS_LABEL[run.status]}</Pill>
              <span className="min-w-0 flex-1 truncate text-[13px] text-fg-muted">{stepSummary(run)}</span>
              {missing > 0 && (
                <span className="text-[12px] text-warning tabular-nums">
                  {missing} {missing === 1 ? "variável sem dado" : "variáveis sem dado"}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
