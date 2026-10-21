"use client";

import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VARIABLE_BY_SLUG } from "@/lib/reports/engine/catalog";
import { MessageBubble, WhatsAppText } from "./WhatsAppText";
import type { ReportRun } from "./types";
import { useCopy } from "./useCopy";

export function MissingVariables({ slugs, title }: { slugs: string[]; title: string }) {
  if (slugs.length === 0) return null;
  return (
    <div className="rounded-control border border-warning/40 bg-warning-tint px-3 py-2 text-[13px] text-warning">
      <p className="font-medium">
        {title} <span className="tabular-nums">({slugs.length})</span>
      </p>
      <ul className="mt-1 flex flex-wrap gap-1.5">
        {slugs.map((slug) => (
          <li key={slug} className="rounded-control bg-surface px-1.5 py-0.5 text-[12px] text-fg">
            {VARIABLE_BY_SLUG.get(slug)?.label ?? "Variável desconhecida"} · <span className="font-mono">{`{{${slug}}}`}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RenderedRun({ run }: { run: ReportRun }) {
  const [copyState, copy] = useCopy();
  const text = run.rendered_body;

  if (!text) {
    return (
      <p className="rounded-control bg-subtle px-3 py-2 text-[13px] text-fg-muted">
        {run.error_message ? `Sem texto gerado: ${run.error_message}` : "Esta geração ainda não tem texto."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-[13px] font-medium text-fg">Texto gerado</h4>
        <div className="flex items-center gap-2">
          <span aria-live="polite" className="text-[13px] text-fg-muted">
            {copyState === "copied" && "Copiado. Ainda não conta como enviado."}
            {copyState === "failed" && "O navegador bloqueou a cópia. Selecione o texto e copie."}
          </span>
          <Button variant="secondary" size="sm" onClick={() => void copy(text)}>
            {copyState === "copied" ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
            Copiar texto
          </Button>
        </div>
      </div>
      <MissingVariables slugs={run.missing_variables} title="Saíram como “—” por falta de dado" />
      <MessageBubble>
        <WhatsAppText text={text} />
      </MessageBubble>
    </div>
  );
}
