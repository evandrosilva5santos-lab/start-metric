"use client";

import { useId } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { REPORT_PERIODS, type ReportPeriod } from "@/lib/reports/period";
import { cn } from "@/lib/utils";
import { PERIOD_LABEL } from "../format";
import type { AdAccountOption } from "../types";
import type { PartDraft } from "./draft";
import { TemplateEditor } from "./TemplateEditor";

interface PartEditorProps {
  part: PartDraft;
  index: number;
  total: number;
  accounts: AdAccountOption[];
  accountsState: "idle" | "loading" | "error" | "ready";
  isActive: boolean;
  onChange: (patch: Partial<PartDraft>) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
  onActivate: () => void;
}

export const FIELD_CLASS =
  "h-11 w-full rounded-control border border-border-strong bg-surface px-3 text-[14px] text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 lg:h-9";

function IconButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex size-11 items-center justify-center rounded-md text-fg-muted hover:bg-subtle hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 lg:size-8"
    >
      {children}
    </button>
  );
}

function accountPlaceholder(state: PartEditorProps["accountsState"], count: number): string {
  if (state === "idle") return "Escolha o cliente primeiro";
  if (state === "loading") return "Carregando contas…";
  if (state === "error") return "Não foi possível carregar as contas";
  return count ? "Todas as contas do cliente" : "Cliente sem conta ligada";
}

export function PartEditor({ part, index, total, accounts, accountsState, isActive, onChange, onMove, onRemove, onActivate }: PartEditorProps) {
  const ids = { account: useId(), period: useId(), start: useId(), end: useId(), heading: useId() };
  const number = index + 1;

  return (
    <section
      aria-labelledby={ids.heading}
      onFocusCapture={onActivate}
      className={cn("flex flex-col gap-4 rounded-panel border bg-surface p-4 transition-colors", isActive ? "border-primary" : "border-border")}
    >
      <header className="flex items-center gap-2">
        <h3 id={ids.heading} className="flex-1 text-[14px] font-semibold text-fg">
          Parte <span className="tabular-nums">{number}</span> <span className="font-normal text-fg-muted">de {total}</span>
        </h3>
        <IconButton label={`Mover parte ${number} para cima`} onClick={() => onMove(-1)} disabled={index === 0}>
          <ArrowUp className="size-4" aria-hidden="true" />
        </IconButton>
        <IconButton label={`Mover parte ${number} para baixo`} onClick={() => onMove(1)} disabled={index === total - 1}>
          <ArrowDown className="size-4" aria-hidden="true" />
        </IconButton>
        <IconButton label={`Remover parte ${number}`} onClick={onRemove} disabled={total <= 1}>
          <Trash2 className="size-4" aria-hidden="true" />
        </IconButton>
      </header>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.account} className="text-[12px] font-medium text-fg-muted">Conta de anúncio (opcional)</label>
          <select
            id={ids.account}
            value={part.ad_account_id ?? ""}
            disabled={accountsState !== "ready"}
            onChange={(e) => onChange({ ad_account_id: e.target.value || null })}
            className={FIELD_CLASS}
          >
            <option value="">{accountPlaceholder(accountsState, accounts.length)}</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
                {a.platform !== "meta" ? ` (${a.platform})` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={ids.period} className="text-[12px] font-medium text-fg-muted">Período dos dados</label>
          <select
            id={ids.period}
            value={part.period}
            onChange={(e) => onChange({ period: e.target.value as ReportPeriod })}
            className={FIELD_CLASS}
          >
            {REPORT_PERIODS.map((p) => (
              <option key={p} value={p}>{PERIOD_LABEL[p]}</option>
            ))}
          </select>
        </div>
        {part.period === "custom" && (
          <>
            <div className="flex flex-col gap-1">
              <label htmlFor={ids.start} className="text-[12px] font-medium text-fg-muted">Início</label>
              <input id={ids.start} type="date" value={part.custom_start} onChange={(e) => onChange({ custom_start: e.target.value })} className={FIELD_CLASS} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor={ids.end} className="text-[12px] font-medium text-fg-muted">Fim</label>
              <input id={ids.end} type="date" value={part.custom_end} min={part.custom_start || undefined} onChange={(e) => onChange({ custom_end: e.target.value })} className={FIELD_CLASS} />
            </div>
          </>
        )}
      </div>

      <label className="flex min-h-11 cursor-pointer items-start gap-2.5 text-[13px] text-fg lg:min-h-0">
        <input
          type="checkbox"
          checked={part.send_without_data}
          onChange={(e) => onChange({ send_without_data: e.target.checked })}
          className="mt-0.5 size-4 shrink-0"
        />
        <span>
          Gerar mesmo sem dados
          <span className="block text-[12px] text-fg-muted">Desligado: se a conta não tiver dado no período, esta parte fica de fora.</span>
        </span>
      </label>

      <TemplateEditor label={`Texto da parte ${number}`} value={part.body} onChange={(body) => onChange({ body })} />
    </section>
  );
}
