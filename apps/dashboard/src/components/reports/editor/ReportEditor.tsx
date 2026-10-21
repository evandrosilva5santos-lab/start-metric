"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { errorMessage, queryKeys, reportsApi } from "../api";
import type { ClientOption } from "../types";
import { draftFromReport, emptyDraft } from "./draft";
import { EditorForm } from "./EditorForm";

interface ReportEditorProps {
  reportId: string | null;
  defaultClientId: string | null;
  clients: ClientOption[];
  clientsState: "loading" | "error" | "ready";
  onClose: () => void;
  onSaved: (id: string) => void;
  onDeleted: () => void;
}

export function ReportEditor({ reportId, defaultClientId, clients, clientsState, onClose, onSaved, onDeleted }: ReportEditorProps) {
  const reportQuery = useQuery({
    queryKey: queryKeys.report(reportId ?? "new"),
    queryFn: () => reportsApi.get(reportId as string),
    enabled: reportId !== null,
    staleTime: 0,
  });

  if (reportId === null || reportQuery.isSuccess) {
    const initial = reportId === null ? emptyDraft(defaultClientId) : draftFromReport(reportQuery.data!);
    return (
      <EditorForm
        key={reportId ?? "new"}
        initial={initial}
        clients={clients}
        clientsState={clientsState}
        onClose={onClose}
        onSaved={onSaved}
        onDeleted={onDeleted}
      />
    );
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="Editor de relatório" className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-bg p-6 text-center">
      {reportQuery.isError ? (
        <>
          <p role="alert" className="max-w-md text-[14px] text-danger">Não foi possível abrir o relatório: {errorMessage(reportQuery.error)}</p>
          <div className="flex gap-2">
            <Button onClick={() => void reportQuery.refetch()}>Tentar de novo</Button>
            <Button variant="secondary" onClick={onClose}>
              <X className="size-4" aria-hidden="true" /> Fechar
            </Button>
          </div>
        </>
      ) : (
        <p className="inline-flex items-center gap-2 text-[14px] text-fg-muted">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Abrindo relatório…
        </p>
      )}
    </div>
  );
}
