import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { EMPTY, formatDateTime, generatedBy } from "./format";
import type { ReportRun } from "./types";

interface Step {
  key: string;
  label: string;
  at: string | null;
  who: string;
}

const GENERATED_STATUSES = new Set(["generated", "sent", "received", "approved"]);

function senderLabel(sentBy: string | null, profileId: string | null): string {
  if (!sentBy) return EMPTY;
  return sentBy === profileId ? "Por você" : "Por outra pessoa da equipe";
}

function stepsFor(run: ReportRun, profileId: string | null): Step[] {
  const generated = GENERATED_STATUSES.has(run.status);
  return [
    { key: "generated", label: "Gerado", at: generated ? (run.finished_at ?? run.created_at) : null, who: generated ? generatedBy(run) : EMPTY },
    { key: "sent", label: "Enviado", at: run.sent_at, who: senderLabel(run.sent_by, profileId) },
    { key: "received", label: "Recebido", at: run.received_at, who: run.received_at ? "Registrado pela equipe" : EMPTY },
    { key: "approved", label: "Aprovado", at: run.approved_at, who: run.approved_at ? "Registrado pela equipe" : EMPTY },
  ];
}

export function DeliveryPipeline({ run, profileId }: { run: ReportRun; profileId: string | null }) {
  const steps = stepsFor(run, profileId);
  const currentIndex = steps.findIndex((s) => !s.at);

  return (
    <ol aria-label="Esteira de entrega" className="grid grid-cols-1 gap-2 sm:grid-cols-4 sm:gap-0">
      {steps.map((step, index) => {
        const done = Boolean(step.at);
        const current = index === currentIndex && run.status !== "failed" && run.status !== "skipped";
        const stateText = done ? "concluído" : current ? "próximo passo" : "aguardando";
        return (
          <li
            key={step.key}
            aria-current={current ? "step" : undefined}
            className="relative flex gap-3 sm:flex-col sm:gap-2 sm:pr-3"
          >
            {index < steps.length - 1 && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute hidden h-px sm:left-7 sm:right-0 sm:top-3.5 sm:block",
                  done ? "bg-success" : "bg-border-strong",
                )}
              />
            )}
            <span
              aria-hidden="true"
              className={cn(
                "relative z-[1] flex size-7 shrink-0 items-center justify-center rounded-full border text-[12px] font-medium tabular-nums",
                done && "border-success bg-success text-success-fg",
                current && "border-primary bg-primary-tint text-primary",
                !done && !current && "border-border-strong bg-surface text-fg-muted",
              )}
            >
              {done ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
            </span>
            <div className="flex min-w-0 flex-col">
              <span className="text-[13px] font-medium text-fg">
                {step.label}
                <span className="sr-only">: {stateText}</span>
              </span>
              <span className={cn("text-[12px] tabular-nums", done ? "text-fg" : current ? "text-primary" : "text-fg-muted")}>
                {done ? formatDateTime(step.at) : current ? "Pendente" : EMPTY}
              </span>
              <span className="text-[12px] text-fg-muted">{step.who}</span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
