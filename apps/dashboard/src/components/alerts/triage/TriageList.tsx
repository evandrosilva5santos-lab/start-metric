"use client";

import { Badge } from "@/components/ui/badge";
import { formatMetricValue } from "@/lib/alerts/message";
import {
  STATE_PRESENTATION,
  formatDateTimeBr,
  metricLabel,
  operatorSymbol,
  severityPresentation,
} from "@/lib/alerts/present";
import type { AlertTriageItem } from "@/lib/alerts/types";
import { cn } from "@/lib/utils";

type TriageListProps = {
  items: readonly AlertTriageItem[];
  selectedId: string | null;
  assigneeName: (id: string | null | undefined) => string;
  onSelect: (id: string) => void;
};

function targetLine(item: AlertTriageItem): string {
  return [item.campaign_name, item.account_name].filter(Boolean).join(" · ") || "—";
}

function ruleLine(item: AlertTriageItem): string {
  const currency = item.metadata?.currency ?? null;
  return `${metricLabel(item.metric)} · ${operatorSymbol(item.operator)} ${formatMetricValue(item.metric, item.threshold, currency)}`;
}

export function SeverityPill({ severity }: { severity: AlertTriageItem["severity"] }) {
  const view = severityPresentation(severity);
  return (
    <Badge variant={view.tone}>
      <span className="sr-only">Severidade: </span>
      {severity ? view.label : <span aria-label="sem severidade">—</span>}
    </Badge>
  );
}

function Pills({ item }: { item: AlertTriageItem }) {
  return <SeverityPill severity={item.severity} />;
}

export function TriageList({ items, selectedId, assigneeName, onSelect }: TriageListProps) {
  return (
    <>
      <ul className="flex flex-col divide-y divide-border overflow-hidden rounded-panel border border-border bg-surface shadow-card md:hidden">
        {items.map((item) => {
          const state = STATE_PRESENTATION[item.state];
          return (
            <li key={item.id}>
              <button
                type="button"
                id={`alerta-${item.id}`}
                aria-current={item.id === selectedId ? "true" : undefined}
                onClick={() => onSelect(item.id)}
                className={cn(
                  "flex min-h-11 w-full flex-col gap-1.5 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  item.id === selectedId && "bg-primary-tint",
                )}
              >
                <span className="flex flex-wrap items-center gap-2">
                  <Pills item={item} />
                  <Badge variant={state.tone}>{state.label}</Badge>
                </span>
                <span className="text-[14px] font-medium text-fg">{item.title}</span>
                <span className="text-[12px] text-fg-muted">
                  {item.client_name ?? "—"} · <span className="num">{formatDateTimeBr(item.triggered_at)}</span> ·{" "}
                  {assigneeName(item.assigned_to)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="hidden overflow-x-auto rounded-panel border border-border bg-surface shadow-card md:block">
        <table className="w-full text-left text-[13px] text-fg">
          <caption className="sr-only">Alertas filtrados. Selecione um alerta para ver a evidência.</caption>
          <thead className="border-b border-border bg-subtle text-[12px] font-medium text-fg-muted">
            <tr>
              <th scope="col" className="px-3 py-2 font-medium">Alerta</th>
              <th scope="col" className="px-3 py-2 font-medium">Cliente</th>
              <th scope="col" className="hidden px-3 py-2 font-medium lg:table-cell">Regra</th>
              <th scope="col" className="px-3 py-2 font-medium">Desde</th>
              <th scope="col" className="px-3 py-2 font-medium">Destinatário</th>
              <th scope="col" className="px-3 py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((item) => {
              const state = STATE_PRESENTATION[item.state];
              const isSelected = item.id === selectedId;
              return (
                <tr
                  key={item.id}
                  onClick={() => onSelect(item.id)}
                  className={cn("cursor-pointer transition-colors hover:bg-subtle", isSelected && "bg-primary-tint hover:bg-primary-tint")}
                >
                  <td className="max-w-[340px] px-3 py-2.5 align-top">
                    <button
                      type="button"
                      id={`alerta-${item.id}`}
                      aria-current={isSelected ? "true" : undefined}
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelect(item.id);
                      }}
                      className="flex min-h-11 w-full flex-col items-start gap-1 rounded-control text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:min-h-0"
                    >
                      <span className="flex max-w-full items-center gap-2">
                        <Pills item={item} />
                        <span className="truncate font-medium">{item.title}</span>
                      </span>
                      <span className="max-w-full truncate text-[12px] text-fg-muted">{targetLine(item)}</span>
                    </button>
                  </td>
                  <td className="px-3 py-2.5 align-top">{item.client_name ?? "—"}</td>
                  <td className="hidden px-3 py-2.5 align-top text-fg-muted lg:table-cell">{ruleLine(item)}</td>
                  <td className="num whitespace-nowrap px-3 py-2.5 align-top">{formatDateTimeBr(item.triggered_at)}</td>
                  <td className="px-3 py-2.5 align-top">{assigneeName(item.assigned_to)}</td>
                  <td className="px-3 py-2.5 align-top">
                    <Badge variant={state.tone}>{state.label}</Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function TriageListSkeleton() {
  return (
    <div role="status" aria-label="Carregando alertas" className="flex flex-col gap-2 rounded-panel border border-border bg-surface p-4 shadow-card">
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="h-10 animate-pulse rounded-control bg-subtle motion-reduce:animate-none" />
      ))}
    </div>
  );
}
