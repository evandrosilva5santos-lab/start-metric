"use client";

import { useEffect, useId, useMemo, useState, type KeyboardEvent } from "react";
import { Search, X } from "lucide-react";
import { FULL_VARIABLE_CATALOG } from "@/lib/reports/engine/catalog";
import type { VariableCategory, VariableDefinition } from "@/lib/reports/engine/types";
import { cn } from "@/lib/utils";

const CATEGORY_LABEL: Partial<Record<VariableCategory, string>> = {
  universal: "Gerais",
  metrics: "Métricas",
  conversions: "Conversões",
  costs: "Custos",
  calculated: "Calculadas",
  video: "Vídeo",
  identification: "Identificação",
  metadata: "Rankings",
};

const REPORT_VARIABLES: readonly VariableDefinition[] = FULL_VARIABLE_CATALOG.filter(
  (v) => v.channel !== "google" && v.scope !== "alert" && v.scope !== "lead",
);

const CATEGORIES = (Object.keys(CATEGORY_LABEL) as VariableCategory[]).filter((c) =>
  REPORT_VARIABLES.some((v) => v.category === c),
);

const normalize = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

interface VariablePickerProps {
  onSelect: (slug: string) => void;
  onClose: () => void;
}

export function VariablePicker({ onSelect, onClose }: VariablePickerProps) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<VariableCategory | "all">("all");
  const [active, setActive] = useState(0);
  const listId = useId();

  const results = useMemo(() => {
    const q = normalize(query.trim());
    return REPORT_VARIABLES.filter(
      (v) =>
        (category === "all" || v.category === category) &&
        (!q || normalize(v.label).includes(q) || v.slug.includes(q) || normalize(v.description ?? "").includes(q)),
    );
  }, [query, category]);

  const activeIndex = Math.min(active, Math.max(results.length - 1, 0));
  const optionId = (i: number) => `${listId}-opt-${i}`;

  useEffect(() => {
    document.getElementById(`${listId}-opt-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, listId]);

  const handleKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(Math.min(activeIndex + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(Math.max(activeIndex - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const chosen = results[activeIndex];
      if (chosen) onSelect(chosen.slug);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }
  };

  return (
    <div
      ref={(el) => {
        if (el && !el.dataset.revealed) {
          el.dataset.revealed = "1";
          el.scrollIntoView({ block: "nearest" });
        }
      }}
      role="dialog"
      aria-label="Inserir variável"
      className="flex max-h-[420px] w-full flex-col overflow-hidden rounded-panel border border-border bg-surface shadow-pop"
    >
      <div className="flex items-center gap-2 border-b border-border p-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-fg-muted" aria-hidden="true" />
          <input
            autoFocus
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={results.length ? optionId(activeIndex) : undefined}
            aria-label="Buscar variável"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={handleKey}
            placeholder="Buscar: alcance, gasto, cpa…"
            className="h-11 w-full rounded-control border border-border-strong bg-surface pl-8 pr-3 text-[14px] text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-9"
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar seletor de variáveis"
          className="flex size-11 items-center justify-center rounded-md text-fg-muted hover:bg-subtle hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:size-9"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border px-2 py-1.5" role="group" aria-label="Categorias">
        {(["all", ...CATEGORIES] as const).map((c) => (
          <button
            key={c}
            type="button"
            aria-pressed={category === c}
            onClick={() => {
              setCategory(c);
              setActive(0);
            }}
            className={cn(
              "h-9 shrink-0 rounded-full px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-7",
              category === c ? "bg-primary text-primary-fg" : "bg-subtle text-fg-muted hover:text-fg",
            )}
          >
            {c === "all" ? "Todas" : CATEGORY_LABEL[c]}
          </button>
        ))}
      </div>

      <ul id={listId} role="listbox" aria-label="Variáveis" className="flex-1 overflow-y-auto p-1">
        {results.map((v, i) => (
          <li
            key={v.slug}
            id={optionId(i)}
            role="option"
            aria-selected={i === activeIndex}
            onMouseDown={(e) => e.preventDefault()}
            onMouseEnter={() => setActive(i)}
            onClick={() => onSelect(v.slug)}
            className={cn(
              "flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-control px-2.5 py-1.5 lg:min-h-9",
              i === activeIndex && "bg-primary-tint",
            )}
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[13px] text-fg">{v.label}</span>
              <span className="truncate font-mono text-[12px] text-fg-muted">{`{{${v.slug}}}`}</span>
            </span>
            {v.exampleValue !== undefined && (
              <span className="hidden shrink-0 text-[12px] text-fg-muted tabular-nums sm:inline">ex.: {String(v.exampleValue).slice(0, 24)}</span>
            )}
          </li>
        ))}
        {results.length === 0 && <li className="px-3 py-6 text-center text-[13px] text-fg-muted">Nenhuma variável com esse nome.</li>}
      </ul>

      <p className="border-t border-border px-3 py-1.5 text-[12px] text-fg-muted">
        <span className="tabular-nums">{results.length}</span> variáveis · ↑↓ para navegar, Enter insere, Esc fecha
      </p>
    </div>
  );
}
