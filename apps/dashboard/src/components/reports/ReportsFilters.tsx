"use client";

import { Kpi } from "@/components/ui/StatCard";
import { cn } from "@/lib/utils";
import { STATE_FILTERS, type ReportState, type StateFilter } from "./format";
import type { ClientOption } from "./types";

interface ReportsFiltersProps {
  clients: ClientOption[];
  clientId: string | null;
  state: StateFilter | null;
  states: ReportState[];
  onClientChange: (clientId: string | null) => void;
  onStateChange: (state: StateFilter | null) => void;
}

const KPI_FILTERS: ReadonlyArray<{ value: StateFilter; detail: string }> = [
  { value: "atrasado", detail: "geração devida e não feita" },
  { value: "enviar", detail: "gerado, falta registrar envio" },
  { value: "cliente", detail: "enviado, aguardando o cliente" },
  { value: "falha", detail: "gerações com erro ou puladas" },
];

function countFor(states: ReportState[], value: StateFilter): number {
  const filter = STATE_FILTERS.find((f) => f.value === value);
  return filter ? states.filter(filter.match).length : 0;
}

export function ReportsFilters({ clients, clientId, state, states, onClientChange, onStateChange }: ReportsFiltersProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {KPI_FILTERS.map(({ value, detail }) => {
          const label = STATE_FILTERS.find((f) => f.value === value)?.label ?? value;
          const active = state === value;
          return (
            <button
              key={value}
              type="button"
              aria-pressed={active}
              onClick={() => onStateChange(active ? null : value)}
              className="rounded-panel text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
            >
              <Kpi
                label={label}
                value={String(countFor(states, value))}
                detail={detail}
                emphasis={value === "atrasado" && countFor(states, value) > 0}
                className={cn("h-full transition-colors hover:border-border-strong", active && "border-primary ring-1 ring-primary")}
              />
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex flex-col gap-1 sm:w-64">
          <span className="text-[12px] font-medium text-fg-muted">Cliente</span>
          <select
            value={clientId ?? ""}
            onChange={(e) => onClientChange(e.target.value || null)}
            className="h-11 rounded-control border border-border-strong bg-surface px-3 text-[14px] text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-9"
          >
            <option value="">Todos os clientes</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <div role="group" aria-labelledby="reports-state-label" className="flex min-w-0 flex-col gap-1">
          <span id="reports-state-label" className="text-[12px] font-medium text-fg-muted">Estado</span>
          <div className="flex flex-wrap gap-1.5">
            <StateChip active={state === null} onClick={() => onStateChange(null)} label="Todos" count={states.length} />
            {STATE_FILTERS.map((f) => (
              <StateChip
                key={f.value}
                active={state === f.value}
                onClick={() => onStateChange(state === f.value ? null : f.value)}
                label={f.label}
                count={states.filter(f.match).length}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StateChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-11 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-8",
        active ? "border-primary bg-primary text-primary-fg" : "border-border-strong bg-surface text-fg hover:bg-subtle",
      )}
    >
      {label}
      <span className={cn("tabular-nums", active ? "text-primary-fg" : "text-fg-muted")}>{count}</span>
    </button>
  );
}
