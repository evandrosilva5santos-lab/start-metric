"use client";

import type { ReactNode } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export interface EntityDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  badge?: ReactNode;
  destructiveLabel?: string;
  onDestructiveAction?: () => void;
  primaryLabel?: string;
  onPrimaryAction?: () => void;
  isSubmitting?: boolean;
  hasUnsavedChanges?: boolean;
  onDiscardRequested?: () => void;
  children: ReactNode;
}

export function EntityDrawer({ open, onOpenChange, title, description, badge, destructiveLabel = "Excluir", onDestructiveAction, primaryLabel = "Salvar alterações", onPrimaryAction, isSubmitting = false, hasUnsavedChanges = false, onDiscardRequested, children }: EntityDrawerProps) {
  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen && hasUnsavedChanges && onDiscardRequested) {
      onDiscardRequested();
      return;
    }
    onOpenChange(nextOpen);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl md:max-w-2xl">
        <SheetHeader className="pr-14">
          <div className="flex flex-wrap items-center gap-2">
            <SheetTitle>{title}</SheetTitle>
            {badge}
          </div>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
        <SheetFooter className="items-center sm:justify-between">
          <div>
            {onDestructiveAction && <Button type="button" variant="destructive" size="sm" onClick={onDestructiveAction}><Trash2 aria-hidden="true" />{destructiveLabel}</Button>}
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <Button type="button" variant="outline" size="sm" onClick={() => handleOpenChange(false)} className="flex-1 sm:flex-none">Cancelar</Button>
            {onPrimaryAction && <Button type="button" size="sm" loading={isSubmitting} onClick={onPrimaryAction} className="flex-1 sm:flex-none">{primaryLabel}</Button>}
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
