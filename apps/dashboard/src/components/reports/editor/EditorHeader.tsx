"use client";

import { Check, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type HeaderConfirm = "discard" | "delete" | null;

interface EditorHeaderProps {
  title: string;
  subtitle: string | null;
  canDelete: boolean;
  confirm: HeaderConfirm;
  isSaving: boolean;
  isDeleting: boolean;
  onRequestClose: () => void;
  onConfirmChange: (confirm: HeaderConfirm) => void;
  onDiscard: () => void;
  onDelete: () => void;
  onSave: () => void;
}

function ConfirmBar({ text, action, danger, busy, onConfirm, onCancel }: {
  text: string;
  action: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div role="alertdialog" aria-label={text} className="flex flex-wrap items-center gap-2 border-b border-border bg-warning-tint px-4 py-2 text-[13px] text-fg md:px-6">
      <span className="flex-1 font-medium">{text}</span>
      <Button size="sm" variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={busy} autoFocus>
        {action}
      </Button>
      <Button size="sm" variant="secondary" onClick={onCancel} disabled={busy}>
        Continuar editando
      </Button>
    </div>
  );
}

export function EditorHeader(props: EditorHeaderProps) {
  const { title, subtitle, canDelete, confirm, isSaving, isDeleting, onRequestClose, onConfirmChange, onDiscard, onDelete, onSave } = props;
  return (
    <>
      <header className="flex min-h-14 items-center gap-2 border-b border-border bg-surface px-2 py-1.5 md:px-4">
        <Button variant="ghost" size="icon" onClick={onRequestClose} aria-label="Fechar editor (Esc)" title="Fechar (Esc)">
          <X className="size-5" aria-hidden="true" />
        </Button>
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 id="report-editor-title" className="truncate font-display text-[16px] font-semibold leading-[1.3] text-fg md:text-[20px]">
            {title}
          </h1>
          {subtitle && <span className="truncate text-[13px] text-fg-muted">{subtitle}</span>}
        </div>
        {canDelete && (
          <Button variant="ghost" onClick={() => onConfirmChange("delete")} aria-label="Excluir relatório" className="text-danger">
            <Trash2 className="size-4" aria-hidden="true" />
            <span className="hidden md:inline">Excluir</span>
          </Button>
        )}
        <Button onClick={onSave} loading={isSaving}>
          <Check className="size-4" aria-hidden="true" />
          Salvar
        </Button>
      </header>
      {confirm === "discard" && (
        <ConfirmBar
          text="Descartar as alterações não salvas?"
          action="Descartar"
          onConfirm={onDiscard}
          onCancel={() => onConfirmChange(null)}
        />
      )}
      {confirm === "delete" && (
        <ConfirmBar
          text="Excluir este relatório e todo o histórico de gerações?"
          action="Excluir"
          danger
          busy={isDeleting}
          onConfirm={onDelete}
          onCancel={() => onConfirmChange(null)}
        />
      )}
    </>
  );
}
