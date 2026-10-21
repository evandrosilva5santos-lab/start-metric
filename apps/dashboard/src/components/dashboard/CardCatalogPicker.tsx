"use client";

import { useId, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { CARD_CATALOG, CARD_GROUPS, MAX_CARDS } from "@/lib/dashboard/cards/catalog";
import { Button } from "@/components/ui/button";

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function CardCatalogPicker({ selected, onAdd }: { selected: readonly string[]; onAdd: (slug: string) => void }) {
  const [query, setQuery] = useState("");
  const headingId = useId();
  const full = selected.length >= MAX_CARDS;

  const groups = useMemo(() => {
    const needle = normalize(query.trim());
    const chosen = new Set(selected);
    return CARD_GROUPS.map((group) => ({
      ...group,
      cards: CARD_CATALOG.filter(
        (card) =>
          card.group === group.id &&
          !chosen.has(card.slug) &&
          (needle === "" || normalize(`${card.label} ${card.hint} ${group.label}`).includes(needle)),
      ),
    })).filter((group) => group.cards.length > 0);
  }, [query, selected]);

  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id={headingId} className="text-sm font-semibold text-foreground">
          Adicionar métrica
        </h3>
        {full && <p className="text-xs text-warning">Limite de {MAX_CARDS} cards atingido</p>}
      </div>
      <label className="relative block">
        <span className="sr-only">Buscar métrica</span>
        <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscar: custo por lead, CTR…"
          className="h-11 w-full rounded-lg border border-border bg-input pl-9 pr-3 text-sm text-text-primary outline-none placeholder:text-text-muted hover:border-white-hairline-strong focus-visible:ring-2 focus-visible:ring-ring"
        />
      </label>

      {groups.length === 0 ? (
        <p className="py-3 text-center text-sm text-text-muted">
          {query ? "Nenhuma métrica com esse nome." : "Todas as métricas já estão na visão."}
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <div key={group.id}>
              <p className="mb-1.5 text-xs font-semibold text-text-secondary">{group.label}</p>
              <ul className="divide-y divide-border rounded-lg border border-border">
                {group.cards.map((card) => (
                  <li key={card.slug} className="flex items-center gap-3 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{card.label}</p>
                      <p className="truncate text-xs text-text-secondary">{card.hint}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={full}
                      onClick={() => onAdd(card.slug)}
                      aria-label={`Adicionar ${card.label}`}
                    >
                      <Plus aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
