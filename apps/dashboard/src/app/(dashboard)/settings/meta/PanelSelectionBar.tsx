"use client";

import { AlertTriangle, EyeOff } from "lucide-react";
import { Button } from "@/components/ui";
import type { LinkedAccountConflict } from "./types";

type Props = {
  total: number;
  selectedCount: number;
  hiding: boolean;
  conflict: LinkedAccountConflict[] | null;
  onToggleAll: (checked: boolean) => void;
  onHide: () => void;
  onConfirmForce: () => void;
  onCancelConflict: () => void;
};

export function PanelSelectionBar({
  total,
  selectedCount,
  hiding,
  conflict,
  onToggleAll,
  onHide,
  onConfirmForce,
  onCancelConflict,
}: Props) {
  if (total === 0) return null;
  const allSelected = selectedCount === total;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-2 py-1">
        <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm text-fg">
          <input
            type="checkbox"
            checked={allSelected}
            ref={(input) => {
              if (input) input.indeterminate = selectedCount > 0 && !allSelected;
            }}
            onChange={(event) => onToggleAll(event.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          {selectedCount > 0 ? (
            <span>
              <span className="font-semibold tabular-nums">{selectedCount}</span>{" "}
              {selectedCount === 1 ? "conta selecionada" : "contas selecionadas"}
            </span>
          ) : (
            <span className="text-fg-muted">Selecionar todas</span>
          )}
        </label>
        <Button
          variant="outline"
          className="ml-auto h-11"
          disabled={selectedCount === 0}
          loading={hiding && !conflict}
          onClick={onHide}
        >
          <EyeOff size={16} aria-hidden="true" />
          Remover do painel
        </Button>
      </div>

      {conflict && (
        <div role="alert" className="rounded-xl border border-warning/30 bg-warning-tint p-4 text-sm">
          <p className="flex items-start gap-2 font-semibold text-warning">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            {conflict.length === 1 ? "Esta conta está ligada a um cliente." : "Estas contas estão ligadas a clientes."} Fora do
            painel, elas saem das telas do cliente até serem adicionadas de novo.
          </p>
          <ul className="mt-2 space-y-1 text-fg">
            {conflict.map((item) => (
              <li key={item.id} className="truncate">
                {item.name} · <span className="text-fg-muted">{item.clientName ?? "—"}</span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button variant="danger" className="h-11" loading={hiding} onClick={onConfirmForce}>
              Remover mesmo assim
            </Button>
            <Button variant="outline" className="h-11" onClick={onCancelConflict}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
