"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useDashboardFilters } from "@/store/dashboard-filters";
import { formatCardValue, type ClientCardsModel } from "@/lib/dashboard/cards/layout";
import { KpiTile } from "@/components/meta/MetaUi";
import { Button } from "@/components/ui/button";
import { CardLayoutEditor } from "@/components/dashboard/CardLayoutEditor";

const PENDING_HINT = "Ações da Meta ainda não sincronizadas em todo o período";

export function ClientCards({ model }: { model: ClientCardsModel }) {
  const hide = useDashboardFilters((s) => s.hideValues);
  const [editing, setEditing] = useState(false);
  const sourceLabel = model.source === "saved" ? "Visão salva para este cliente" : model.defaultLabel;

  return (
    <section aria-labelledby="client-cards-title" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <h2 id="client-cards-title" className="truncate font-display text-base font-semibold text-foreground">
            Métricas de {model.clientName}
          </h2>
          <p className="text-xs text-text-secondary">
            {sourceLabel}
            {model.truncated && " · período grande, parte das linhas ficou de fora"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)} aria-haspopup="dialog">
          <SlidersHorizontal aria-hidden="true" />
          Personalizar
        </Button>
      </div>

      {model.cards.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-4 text-sm text-text-secondary">
          Nenhuma métrica escolhida. Use “Personalizar” para adicionar.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {model.cards.map((card, index) => (
            <li key={card.slug} className="min-w-0">
              <KpiTile
                label={card.label}
                value={formatCardValue(card.format, card.value, hide)}
                hint={card.pending ? PENDING_HINT : card.hint}
                variation={card.delta}
                sense={card.sense}
                emphasis={index === 1}
              />
            </li>
          ))}
        </ul>
      )}

      {editing && <CardLayoutEditor model={model} onClose={() => setEditing(false)} />}
    </section>
  );
}
