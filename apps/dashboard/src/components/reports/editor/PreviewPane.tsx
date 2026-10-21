"use client";

import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { renderTemplate } from "@/lib/reports/engine/render";
import { resolvePeriod } from "@/lib/reports/period";
import { cn } from "@/lib/utils";
import { PERIOD_LABEL } from "../format";
import { MissingVariables } from "../RenderedRun";
import { MessageBubble, WhatsAppText } from "../WhatsAppText";
import type { PartDraft } from "./draft";
import type { LivePart, LivePreview } from "./useLivePreview";

export type PreviewMode = "preview" | "live";

interface PreviewPaneProps {
  parts: readonly PartDraft[];
  clientName: string | null;
  hasClient: boolean;
  timezone: string;
  mode: PreviewMode;
  onModeChange: (mode: PreviewMode) => void;
  live: LivePreview;
  activeKey: string | null;
}

interface RenderedPart {
  key: string;
  text: string | null;
  missing: string[];
  warnings: string[];
  note: string | null;
}

function examplePart(part: PartDraft, clientName: string | null, timezone: string, now: Date): RenderedPart {
  let dates: { startDate?: string; endDate?: string } = {};
  try {
    dates = resolvePeriod({ period: part.period, customStart: part.custom_start, customEnd: part.custom_end }, now, timezone);
  } catch {
    dates = {};
  }
  const { text, missing } = renderTemplate(part.body, { clientName: clientName ?? undefined, ...dates, timezone, now }, "preview");
  return { key: part.key, text: part.body.trim() ? text : null, missing, warnings: [], note: part.body.trim() ? null : "Parte sem texto." };
}

function livePart(part: PartDraft, state: LivePart | undefined): RenderedPart {
  if (!state || state.state === "pending") return { key: part.key, text: null, missing: [], warnings: [], note: "Aguardando dados reais…" };
  if (state.state === "error") return { key: part.key, text: null, missing: [], warnings: [], note: state.message };
  const skipped = !state.result.text.trim();
  return {
    key: part.key,
    text: skipped ? null : state.result.text,
    missing: state.result.missing,
    warnings: state.result.warnings,
    note: skipped ? "Sem dados no período: esta parte sairia vazia." : null,
  };
}

const MODES: ReadonlyArray<{ value: PreviewMode; label: string }> = [
  { value: "preview", label: "Exemplo" },
  { value: "live", label: "Dados reais" },
];

export function PreviewPane({ parts, clientName, hasClient, timezone, mode, onModeChange, live, activeKey }: PreviewPaneProps) {
  const rendered = useMemo(() => {
    const now = new Date();
    return parts.map((p) => (mode === "live" ? livePart(p, live.byKey[p.key]) : examplePart(p, clientName, timezone, now)));
  }, [parts, mode, live.byKey, clientName, timezone]);

  const missing = [...new Set(rendered.flatMap((r) => r.missing))];

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[14px] font-semibold text-fg">Pré-visualização</h2>
        <div role="group" aria-label="Fonte dos valores" className="inline-flex rounded-md border border-border-strong bg-subtle p-0.5">
          {MODES.map((m) => (
            <button
              key={m.value}
              type="button"
              aria-pressed={mode === m.value}
              onClick={() => onModeChange(m.value)}
              className={cn(
                "h-10 rounded-[5px] px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-7",
                mode === m.value ? "bg-surface text-fg shadow-card" : "text-fg-muted hover:text-fg",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[13px] text-fg-muted" aria-live="polite">
        {mode === "preview" && "Valores de exemplo. Nenhum dado real é consultado."}
        {mode === "live" && !hasClient && "Escolha o cliente para ver os dados reais."}
        {mode === "live" && hasClient && live.isLoading && (
          <span className="inline-flex items-center gap-1.5">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Consultando a Meta…
          </span>
        )}
        {mode === "live" && hasClient && !live.isLoading && "Atualiza quando você para de digitar. O que faltar sai como “—”."}
      </p>

      {mode === "live" && live.rateLimit && (
        <p role="status" className="rounded-control bg-warning-tint px-3 py-2 text-[13px] text-warning">
          {live.rateLimit.message} A pré-visualização volta sozinha depois desse tempo.
        </p>
      )}

      <ol className="flex flex-col gap-3" aria-label="Mensagens por parte">
        {rendered.map((r, index) => (
          <li key={r.key} className={cn("-m-2 flex flex-col gap-1.5 rounded-panel p-2", activeKey === r.key && "ring-2 ring-primary")}>
            <span className="text-[12px] text-fg-muted">
              Parte <span className="tabular-nums">{index + 1}</span> · {PERIOD_LABEL[parts[index].period]}
            </span>
            {r.text !== null ? (
              <MessageBubble meta={mode === "live" ? "dados reais" : "exemplo"}>
                <WhatsAppText text={r.text} />
              </MessageBubble>
            ) : (
              <p className="rounded-panel border border-dashed border-border-strong px-3 py-4 text-center text-[13px] text-fg-muted">{r.note}</p>
            )}
            {r.warnings.map((w) => (
              <p key={w} className="text-[12px] text-warning">{w}</p>
            ))}
          </li>
        ))}
      </ol>

      <MissingVariables
        slugs={missing}
        title={mode === "live" ? "Variáveis sem dado neste período" : "Variáveis que o sistema não conhece"}
      />
    </div>
  );
}
