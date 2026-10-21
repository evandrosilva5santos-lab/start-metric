"use client";

import type { ReactNode } from "react";
import { CheckSquare, LayoutGrid, Search, Table2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  searchLabel?: string;
  placeholder?: string;
  viewMode?: "cards" | "table";
  onViewModeChange?: (mode: "cards" | "table") => void;
  isSelectMode?: boolean;
  onToggleSelectMode?: () => void;
  children?: ReactNode;
  className?: string;
}

export function FilterBar({ search, onSearchChange, searchLabel = "Buscar", placeholder = "Buscar…", viewMode = "cards", onViewModeChange, isSelectMode = false, onToggleSelectMode, children, className }: FilterBarProps) {
  return (
    <div className={cn("flex flex-col gap-3 py-2 md:flex-row md:items-center md:justify-between", className)}>
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative block min-w-0 flex-1 sm:max-w-sm">
          <span className="sr-only">{searchLabel}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input type="search" value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder={placeholder} className="h-11 w-full rounded-button border border-input bg-background pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring lg:h-9" />
        </label>
        {children}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onToggleSelectMode && <Button size="sm" variant={isSelectMode ? "secondary" : "outline"} onClick={onToggleSelectMode} aria-pressed={isSelectMode}><CheckSquare aria-hidden="true" />{isSelectMode ? "Cancelar" : "Selecionar"}</Button>}
        {onViewModeChange && (
          <div className="flex items-center rounded-lg border border-border bg-muted/50 p-0.5" role="group" aria-label="Modo de visualização">
            <button type="button" onClick={() => onViewModeChange("cards")} aria-label="Visualizar em cartões" aria-pressed={viewMode === "cards"} className={cn("flex size-11 items-center justify-center rounded-md text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:size-8", viewMode === "cards" && "bg-card text-foreground shadow-sm")}><LayoutGrid className="size-4" aria-hidden="true" /></button>
            <button type="button" onClick={() => onViewModeChange("table")} aria-label="Visualizar em tabela" aria-pressed={viewMode === "table"} className={cn("flex size-11 items-center justify-center rounded-md text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:size-8", viewMode === "table" && "bg-card text-foreground shadow-sm")}><Table2 className="size-4" aria-hidden="true" /></button>
          </div>
        )}
      </div>
    </div>
  );
}
