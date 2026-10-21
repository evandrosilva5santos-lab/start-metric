"use client";

import { useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { errorMessage, queryKeys, reportsApi } from "./api";
import type { DeliveryStep, ReportRun, RunStatus } from "./types";

interface NextStep {
  step: DeliveryStep;
  cta: string;
  placeholder: string;
}

const NEXT_STEP: Partial<Record<RunStatus, NextStep>> = {
  generated: {
    step: "sent",
    cta: "Registrar envio",
    placeholder: "Ex.: enviado no grupo do cliente às 9h; print salvo no Drive",
  },
  sent: { step: "received", cta: "Registrar recebimento", placeholder: "Ex.: cliente confirmou a leitura às 10h" },
  received: { step: "approved", cta: "Registrar aprovação", placeholder: "Ex.: aprovado pela Ana por áudio" },
};

const CHANNELS = ["WhatsApp", "E-mail", "Reunião", "Outro"] as const;
const MAX_NOTE = 2000;

function composeNote(step: DeliveryStep, channel: string, note: string): string | undefined {
  const trimmed = note.trim();
  if (step !== "sent") return trimmed || undefined;
  return trimmed ? `Canal: ${channel}. ${trimmed}` : `Canal: ${channel}.`;
}

export function DeliveryForm({ run, reportId }: { run: ReportRun; reportId: string }) {
  const next = NEXT_STEP[run.status];
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [channel, setChannel] = useState<string>(CHANNELS[0]);
  const noteId = useId();
  const channelId = useId();

  const mutation = useMutation({
    mutationFn: (input: NextStep) => reportsApi.deliver(run.id, input.step, composeNote(input.step, channel, note)),
    onSuccess: async () => {
      setOpen(false);
      setNote("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.runs(reportId) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.reportsAll }),
      ]);
    },
  });

  if (!next) return null;

  if (!open) {
    return (
      <div className="flex flex-col gap-2">
        <Button onClick={() => setOpen(true)} className="self-start">
          <Send className="size-4" aria-hidden="true" />
          {next.cta}
        </Button>
        {mutation.isSuccess && (
          <p role="status" className="text-[13px] text-success">Passo registrado.</p>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutation.mutate(next);
      }}
      className="flex flex-col gap-3 rounded-panel border border-border bg-subtle p-3.5"
      aria-label={next.cta}
    >
      {next.step === "sent" && (
        <div className="flex flex-col gap-1">
          <label htmlFor={channelId} className="text-[12px] font-medium text-fg-muted">Canal</label>
          <select
            id={channelId}
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="h-11 rounded-control border border-border-strong bg-surface px-3 text-[14px] text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-9"
          >
            {CHANNELS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label htmlFor={noteId} className="text-[12px] font-medium text-fg-muted">
          Nota ou comprovante <span className="font-normal">(opcional)</span>
        </label>
        <textarea
          id={noteId}
          autoFocus
          value={note}
          maxLength={MAX_NOTE}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder={next.placeholder}
          className="resize-y rounded-control border border-border-strong bg-surface px-3 py-2 text-[14px] text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <span className="self-end text-[12px] text-fg-muted tabular-nums">{note.length}/{MAX_NOTE}</span>
      </div>
      {mutation.isError && (
        <p role="alert" className="rounded-control bg-danger-tint px-3 py-2 text-[13px] text-danger">
          {errorMessage(mutation.error)}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" loading={mutation.isPending}>Confirmar</Button>
        <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={mutation.isPending}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
