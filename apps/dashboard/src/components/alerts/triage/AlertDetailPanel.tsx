"use client";

import { useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTriageMutation } from "@/hooks/useAlertTriage";
import { accountStatusLabel, formatDateBr, formatMetricValue } from "@/lib/alerts/message";
import { STATE_PRESENTATION, formatDateTimeBr, metricLabel, operatorSymbol } from "@/lib/alerts/present";
import { RESOLUTION_NOTE_MAX } from "@/lib/alerts/schemas";
import type { AlertAssignee, AlertTriageItem } from "@/lib/alerts/types";
import { FIELD_CLASS, assigneeOptions } from "./TriageFilters";
import { SeverityPill } from "./TriageList";

type AlertDetailPanelProps = {
  item: AlertTriageItem;
  assignees: readonly AlertAssignee[];
  meId: string | null;
  assigneeName: (id: string | null | undefined) => string;
  onUpdated: (item: AlertTriageItem) => void;
  onClose: () => void;
};

function Evidence({ label, value, numeric = false }: { label: string; value: string; numeric?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-[12px] text-fg-muted">{label}</dt>
      <dd className={numeric ? "num text-[16px] font-medium text-fg" : "break-words text-[14px] text-fg"}>{value}</dd>
    </div>
  );
}

function currentValueText(item: AlertTriageItem): string {
  const currency = item.metadata?.currency ?? null;
  if (item.metric !== "api_error") return formatMetricValue(item.metric, item.observed_value, currency);
  const status = accountStatusLabel(item.metadata?.account_status);
  const hours = item.observed_value > 0 ? `${formatMetricValue("api_error", item.observed_value)} sem sincronizar` : null;
  return [status, hours].filter(Boolean).join(" · ") || "—";
}

function periodText(item: AlertTriageItem): string {
  const start = item.metadata?.period_start;
  const end = item.metadata?.period_end;
  if (!start || !end) return "—";
  return start === end ? formatDateBr(start) : `${formatDateBr(start)} a ${formatDateBr(end)}`;
}

export function AlertDetailPanel({ item, assignees, meId, assigneeName, onUpdated, onClose }: AlertDetailPanelProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const noteId = useId();
  const [isResolving, setIsResolving] = useState(false);
  const [note, setNote] = useState("");
  const mutation = useTriageMutation();
  const state = STATE_PRESENTATION[item.state];
  const currency = item.metadata?.currency ?? null;
  const missing = item.metadata?.missing_variables ?? [];

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submitResolve = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!note.trim()) return;
    mutation.mutate(
      { kind: "resolve", id: item.id, note },
      {
        onSuccess: (updated) => {
          setIsResolving(false);
          onUpdated(updated);
        },
      },
    );
  };

  const people = [
    { value: "", label: "Sem destinatário" },
    ...(meId ? [{ value: meId, label: "Eu" }] : []),
    ...assigneeOptions(assignees, meId),
  ];
  const assigned = item.assigned_to ?? "";
  const peopleWithCurrent = people.some((p) => p.value === assigned)
    ? people
    : [...people, { value: assigned, label: assigneeName(assigned) }];

  return (
    <div className="fixed inset-0 z-50 flex justify-end lg:sticky lg:inset-auto lg:top-4 lg:z-auto lg:block">
      <div className="absolute inset-0 bg-fg/40 lg:hidden" aria-hidden="true" onClick={onClose} />
      <aside
        aria-labelledby={`${noteId}-titulo`}
        className="relative flex h-full w-full max-w-[440px] flex-col gap-5 overflow-y-auto bg-surface p-4 shadow-pop motion-safe:animate-fade-in sm:p-5 lg:h-auto lg:max-h-[calc(100vh-120px)] lg:max-w-none lg:rounded-panel lg:border lg:border-border lg:shadow-card"
      >
        <header className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityPill severity={item.severity} />
              <Badge variant={state.tone}>{state.label}</Badge>
            </div>
            <h2
              id={`${noteId}-titulo`}
              ref={headingRef}
              tabIndex={-1}
              className="text-[16px] font-semibold leading-[1.3] text-fg focus:outline-none"
            >
              {item.title}
            </h2>
            <p className="text-[13px] text-fg-muted">
              Disparou em <span className="num">{formatDateTimeBr(item.triggered_at)}</span>
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar painel do alerta">
            <X size={18} aria-hidden="true" />
          </Button>
        </header>

        <section aria-label="Evidência" className="flex flex-col gap-3">
          <h3 className="text-[13px] font-medium text-fg-muted">Evidência</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Evidence label="Valor atual" value={currentValueText(item)} numeric={item.metric !== "api_error"} />
            <Evidence
              label="Limite"
              value={`${operatorSymbol(item.operator)} ${formatMetricValue(item.metric, item.threshold, currency)}`}
              numeric
            />
            <Evidence label="Período" value={periodText(item)} />
            <Evidence label="Regra" value={metricLabel(item.metric)} />
            <Evidence label="Cliente" value={item.client_name ?? "—"} />
            <Evidence label="Conta" value={item.account_name ?? "—"} />
            <div className="col-span-2">
              <Evidence label="Campanha" value={item.campaign_name ?? "—"} />
            </div>
          </dl>
        </section>

        <section aria-label="Mensagem do modelo" className="flex flex-col gap-2">
          <h3 className="text-[13px] font-medium text-fg-muted">Mensagem do modelo</h3>
          <p className="whitespace-pre-wrap break-words rounded-control border border-border bg-subtle p-3 text-[13px] leading-[1.5] text-fg">
            {item.message || "—"}
          </p>
          {missing.length > 0 && (
            <p className="text-[12px] text-fg-muted">Sem dado para: {missing.join(", ")} (aparece como —).</p>
          )}
        </section>

        <section aria-label="Destinatário" className="flex flex-col gap-1">
          <label htmlFor={`${noteId}-destinatario`} className="text-[13px] font-medium text-fg-muted">
            Destinatário
          </label>
          <select
            id={`${noteId}-destinatario`}
            value={assigned}
            disabled={mutation.isPending}
            onChange={(event) =>
              mutation.mutate({ kind: "assign", id: item.id, assignedTo: event.target.value || null }, { onSuccess: onUpdated })
            }
            className={FIELD_CLASS}
          >
            {peopleWithCurrent.map((person) => (
              <option key={person.value || "none"} value={person.value}>
                {person.label}
              </option>
            ))}
          </select>
        </section>

        {item.state === "resolved" ? (
          <section aria-label="Resolução" className="flex flex-col gap-1 rounded-control border-l-[3px] border-success bg-success-tint px-3 py-2">
            <p className="text-[13px] font-medium text-fg">
              Resolvido em <span className="num">{formatDateTimeBr(item.resolved_at)}</span>
            </p>
            <p className="whitespace-pre-wrap break-words text-[13px] text-fg">{item.resolution_note || "—"}</p>
          </section>
        ) : isResolving ? (
          <form onSubmit={submitResolve} className="flex flex-col gap-2">
            <label htmlFor={`${noteId}-nota`} className="text-[13px] font-medium text-fg">
              Nota de resolução <span className="text-fg-muted">(obrigatória)</span>
            </label>
            <textarea
              id={`${noteId}-nota`}
              required
              rows={4}
              maxLength={RESOLUTION_NOTE_MAX}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              aria-describedby={`${noteId}-contador`}
              className="w-full rounded-control border border-border-strong bg-surface p-2.5 text-[14px] text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="O que foi feito ou por que não precisa de ação"
            />
            <p id={`${noteId}-contador`} className="num text-right text-[12px] text-fg-muted">
              {note.length}/{RESOLUTION_NOTE_MAX}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={!note.trim()} loading={mutation.isPending}>
                Confirmar resolução
              </Button>
              <Button type="button" variant="ghost" onClick={() => setIsResolving(false)}>
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap gap-2">
            {item.state === "open" && (
              <Button
                loading={mutation.isPending}
                onClick={() => mutation.mutate({ kind: "acknowledge", id: item.id }, { onSuccess: onUpdated })}
              >
                Reconhecer
              </Button>
            )}
            <Button variant="secondary" disabled={mutation.isPending} onClick={() => setIsResolving(true)}>
              Resolver com nota
            </Button>
          </div>
        )}

        {mutation.isError && (
          <p role="alert" className="text-[13px] text-danger">
            {mutation.error.message}
          </p>
        )}

        <p className="mt-auto border-t border-border pt-3 text-[12px] text-fg-muted">
          Alerta não é diagnóstico: confirme nos dados antes de falar com o cliente. Resolvido só volta se o limite for
          cruzado de novo em outro período.
        </p>
      </aside>
    </div>
  );
}
