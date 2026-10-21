"use client";

import { useCallback, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ApiError, errorMessage, queryKeys, reportsApi } from "../api";
import type { ClientOption } from "../types";
import { useOverlay } from "../useOverlay";
import { MAX_PARTS, emptyPart, isSameDraft, movePart, removePart, toPayload, unknownSlugs, updatePart, validateDraft, type ReportDraft } from "./draft";
import { EditorHeader, type HeaderConfirm } from "./EditorHeader";
import { PartEditor } from "./PartEditor";
import { PreviewPane, type PreviewMode } from "./PreviewPane";
import { ScheduleSection } from "./ScheduleSection";
import { useLivePreview } from "./useLivePreview";

interface EditorFormProps {
  initial: ReportDraft;
  clients: ClientOption[];
  clientsState: "loading" | "error" | "ready";
  onClose: () => void;
  onSaved: (id: string) => void;
  onDeleted: () => void;
}

type MobileTab = "edit" | "preview";

function revealOnMount(el: HTMLDivElement | null): void {
  if (!el) return;
  el.scrollIntoView({ block: "nearest" });
  el.focus({ preventScroll: true });
}

function saveErrorLines(err: unknown): string[] {
  if (err instanceof ApiError && err.issues.length > 0) return [err.message, ...err.issues];
  return [errorMessage(err)];
}

export function EditorForm({ initial, clients, clientsState, onClose, onSaved, onDeleted }: EditorFormProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [initialDraft] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [activeKey, setActiveKey] = useState<string | null>(initial.parts[0]?.key ?? null);
  const [mode, setMode] = useState<PreviewMode>("preview");
  const [tab, setTab] = useState<MobileTab>("edit");
  const [confirm, setConfirm] = useState<HeaderConfirm>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [pendingWarnings, setPendingWarnings] = useState<string[] | null>(null);

  const isDirty = !isSameDraft(draft, initialDraft);
  const clientName = clients.find((c) => c.id === draft.client_id)?.name ?? null;

  const accountsQuery = useQuery({
    queryKey: queryKeys.accounts(draft.client_id),
    queryFn: () => reportsApi.accounts(draft.client_id),
    enabled: Boolean(draft.client_id),
    staleTime: 5 * 60_000,
  });
  const accountsState = !draft.client_id ? "idle" : accountsQuery.isPending ? "loading" : accountsQuery.isError ? "error" : "ready";

  const live = useLivePreview({ parts: draft.parts, clientId: draft.client_id, timezone: draft.timezone, enabled: mode === "live" });

  const requestClose = useCallback(() => {
    if (isDirty) setConfirm("discard");
    else onClose();
  }, [isDirty, onClose]);

  useOverlay(true, containerRef, requestClose);

  const save = useMutation({
    mutationFn: () => {
      const payload = toPayload(draft);
      return draft.id ? reportsApi.update(draft.id, payload) : reportsApi.create(payload);
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.reportsAll });
      onSaved(saved.id);
    },
    onError: (err) => setErrors(saveErrorLines(err)),
  });

  const remove = useMutation({
    mutationFn: () => reportsApi.remove(draft.id as string),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.reportsAll });
      onDeleted();
    },
    onError: (err) => {
      setConfirm(null);
      setErrors([errorMessage(err)]);
    },
  });

  const patch = (next: Partial<ReportDraft>) => {
    setDraft((d) => ({ ...d, ...next }));
    setPendingWarnings(null);
  };

  const handleSave = (force = false) => {
    const problems = validateDraft(draft);
    setErrors(problems);
    if (problems.length > 0) {
      setTab("edit");
      return;
    }
    const liveMissing = mode === "live" ? Object.values(live.byKey).flatMap((p) => (p.state === "ready" ? p.result.missing : [])) : [];
    const unknown = unknownSlugs(draft.parts);
    const warnings = [
      ...unknown.map((s) => `{{${s}}} não existe no catálogo e vai sair como “—”.`),
      ...[...new Set(liveMissing)].filter((s) => !unknown.includes(s)).map((s) => `{{${s}}} está sem dado no período escolhido.`),
    ];
    if (warnings.length > 0 && !force) {
      setPendingWarnings(warnings);
      return;
    }
    setPendingWarnings(null);
    save.mutate();
  };

  const parts = draft.parts;
  const title = draft.id ? "Editar relatório" : "Novo relatório";

  return (
    <div ref={containerRef} role="dialog" aria-modal="true" aria-labelledby="report-editor-title" className="fixed inset-0 z-50 flex flex-col bg-bg animate-fade-in">
      <EditorHeader
        title={title}
        subtitle={clientName}
        canDelete={draft.id !== null}
        confirm={confirm}
        isSaving={save.isPending}
        isDeleting={remove.isPending}
        onRequestClose={requestClose}
        onConfirmChange={setConfirm}
        onDiscard={onClose}
        onDelete={() => remove.mutate()}
        onSave={() => handleSave()}
      />

      <div role="tablist" aria-label="Área do editor" className="flex border-b border-border bg-surface lg:hidden">
        {(["edit", "preview"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            type="button"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "h-11 flex-1 border-b-2 text-[14px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
              tab === t ? "border-primary text-fg" : "border-transparent text-fg-muted",
            )}
          >
            {t === "edit" ? "Editar" : "Pré-visualizar"}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(380px,460px)]">
        <div className={cn("h-full overflow-y-auto px-4 py-4 md:px-6 lg:block lg:py-6", tab === "edit" ? "block" : "hidden")}>
          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            {errors.length > 0 && (
              <div ref={revealOnMount} tabIndex={-1} role="alert" className="rounded-panel border border-danger/40 bg-danger-tint px-4 py-3 text-[13px] text-danger">
                <p className="font-medium">Corrija antes de salvar:</p>
                <ul className="mt-1 list-disc pl-5">
                  {errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
            {pendingWarnings && (
              <div ref={revealOnMount} tabIndex={-1} role="alert" className="flex flex-col gap-2 rounded-panel border border-warning/40 bg-warning-tint px-4 py-3 text-[13px] text-warning">
                <p className="font-medium">Há variáveis que vão sair como “—”:</p>
                <ul className="list-disc pl-5">
                  {pendingWarnings.map((w) => (
                    <li key={w} className="font-mono text-[13px]">{w}</li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => handleSave(true)} loading={save.isPending}>Salvar assim mesmo</Button>
                  <Button size="sm" variant="secondary" onClick={() => setPendingWarnings(null)}>Revisar o texto</Button>
                </div>
              </div>
            )}

            <ScheduleSection draft={draft} clients={clients} clientsState={clientsState} onChange={patch} />

            <div className="flex items-center justify-between gap-2 pt-2">
              <h2 className="text-[16px] font-semibold text-fg">
                Partes <span className="font-normal text-fg-muted tabular-nums">({parts.length})</span>
              </h2>
              <span className="text-[12px] text-fg-muted">Cada parte vira uma mensagem, com conta e período próprios.</span>
            </div>

            {parts.map((part, index) => (
              <PartEditor
                key={part.key}
                part={part}
                index={index}
                total={parts.length}
                accounts={accountsQuery.data ?? []}
                accountsState={accountsState}
                isActive={activeKey === part.key}
                onActivate={() => setActiveKey(part.key)}
                onChange={(next) => patch({ parts: updatePart(parts, part.key, next) })}
                onMove={(delta) => patch({ parts: movePart(parts, part.key, delta) })}
                onRemove={() => patch({ parts: removePart(parts, part.key) })}
              />
            ))}

            <Button
              variant="secondary"
              className="self-start"
              disabled={parts.length >= MAX_PARTS}
              onClick={() => {
                const part = emptyPart();
                patch({ parts: [...parts, part] });
                setActiveKey(part.key);
              }}
            >
              <Plus className="size-4" aria-hidden="true" />
              Adicionar parte
            </Button>
          </div>
        </div>

        <aside
          aria-label="Pré-visualização"
          className={cn("h-full overflow-y-auto border-border bg-subtle px-4 py-4 md:px-6 lg:block lg:border-l lg:px-5 lg:py-6", tab === "preview" ? "block" : "hidden")}
        >
          <PreviewPane
            parts={parts}
            clientName={clientName}
            hasClient={Boolean(draft.client_id)}
            timezone={draft.timezone}
            mode={mode}
            onModeChange={setMode}
            live={live}
            activeKey={activeKey}
          />
        </aside>
      </div>
    </div>
  );
}
