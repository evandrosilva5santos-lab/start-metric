"use client";

import { useId } from "react";
import { REPORT_FREQUENCIES, type ReportFrequency } from "@/lib/reports/schedule";
import { cn } from "@/lib/utils";
import { FREQUENCY_LABEL, REPORT_STATUS_LABEL, WEEKDAYS } from "../format";
import type { ClientOption, ReportStatus } from "../types";
import type { ReportDraft } from "./draft";
import { FIELD_CLASS } from "./PartEditor";

interface ScheduleSectionProps {
  draft: ReportDraft;
  clients: ClientOption[];
  clientsState: "loading" | "error" | "ready";
  onChange: (patch: Partial<ReportDraft>) => void;
}

const STATUSES: ReadonlyArray<{ value: ReportStatus; hint: string }> = [
  { value: "draft", hint: "não gera sozinho" },
  { value: "active", hint: "gera na agenda" },
  { value: "paused", hint: "agenda suspensa" },
];

const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

export function ScheduleSection({ draft, clients, clientsState, onChange }: ScheduleSectionProps) {
  const ids = { name: useId(), client: useId(), frequency: useId(), time: useId(), weekday: useId(), monthDay: useId() };

  const changeFrequency = (frequency: ReportFrequency) =>
    onChange({
      frequency,
      weekday: frequency === "weekly" ? (draft.weekday ?? 1) : null,
      month_day: frequency === "monthly" ? (draft.month_day ?? 1) : null,
    });

  return (
    <section aria-label="Identificação e agenda" className="flex flex-col gap-4 rounded-panel border border-border bg-surface p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.name} className="text-[12px] font-medium text-fg-muted">Nome do relatório</label>
          <input
            id={ids.name}
            data-autofocus
            value={draft.name}
            maxLength={120}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Ex.: Resumo semanal Meta"
            className={FIELD_CLASS}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.client} className="text-[12px] font-medium text-fg-muted">Cliente</label>
          <select
            id={ids.client}
            value={draft.client_id}
            disabled={clientsState !== "ready"}
            onChange={(e) => onChange({ client_id: e.target.value, parts: draft.parts.map((p) => ({ ...p, ad_account_id: null })) })}
            className={FIELD_CLASS}
          >
            <option value="">
              {clientsState === "loading" ? "Carregando clientes…" : clientsState === "error" ? "Erro ao carregar clientes" : "Escolha o cliente"}
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.frequency} className="text-[12px] font-medium text-fg-muted">Frequência</label>
          <select id={ids.frequency} value={draft.frequency} onChange={(e) => changeFrequency(e.target.value as ReportFrequency)} className={FIELD_CLASS}>
            {REPORT_FREQUENCIES.map((f) => (
              <option key={f} value={f}>{FREQUENCY_LABEL[f]}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.time} className="text-[12px] font-medium text-fg-muted">Horário</label>
          <input id={ids.time} type="time" value={draft.send_time} onChange={(e) => onChange({ send_time: e.target.value })} className={cn(FIELD_CLASS, "tabular-nums")} />
        </div>
        {draft.frequency === "weekly" && (
          <div className="flex flex-col gap-1">
            <label htmlFor={ids.weekday} className="text-[12px] font-medium text-fg-muted">Dia da semana</label>
            <select id={ids.weekday} value={draft.weekday ?? 1} onChange={(e) => onChange({ weekday: Number(e.target.value) })} className={FIELD_CLASS}>
              {WEEKDAYS.map((d, i) => (
                <option key={d} value={i}>{d}</option>
              ))}
            </select>
          </div>
        )}
        {draft.frequency === "monthly" && (
          <div className="flex flex-col gap-1">
            <label htmlFor={ids.monthDay} className="text-[12px] font-medium text-fg-muted">Dia do mês</label>
            <select id={ids.monthDay} value={draft.month_day ?? 1} onChange={(e) => onChange({ month_day: Number(e.target.value) })} className={cn(FIELD_CLASS, "tabular-nums")}>
              {MONTH_DAYS.map((d) => (
                <option key={d} value={d}>{d === 31 ? "31 (ou último dia)" : d}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-[12px] font-medium text-fg-muted">Estado</legend>
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((s) => (
            <label
              key={s.value}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3 text-[13px] transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring lg:min-h-8",
                draft.status === s.value ? "border-primary bg-primary-tint text-primary" : "border-border-strong text-fg hover:bg-subtle",
              )}
            >
              <input
                type="radio"
                name="report-status"
                value={s.value}
                checked={draft.status === s.value}
                onChange={() => onChange({ status: s.value })}
                className="sr-only"
              />
              <span className="font-medium">{REPORT_STATUS_LABEL[s.value]}</span>
              <span className="text-[12px] text-fg-muted">{s.hint}</span>
            </label>
          ))}
        </div>
        <p className="text-[12px] text-fg-muted">Fuso: {draft.timezone}</p>
      </fieldset>
    </section>
  );
}
