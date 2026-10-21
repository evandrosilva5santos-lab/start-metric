"use client";

import { useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, GripVertical, RotateCcw, X } from "lucide-react";
import { CARD_BY_SLUG, MAX_CARDS, groupLabel } from "@/lib/dashboard/cards/catalog";
import { moveItem, sameCards, type ClientCardsModel } from "@/lib/dashboard/cards/layout";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CardCatalogPicker } from "@/components/dashboard/CardCatalogPicker";

type Props = { model: ClientCardsModel; onClose: () => void };

async function persist(clientId: string, cards: readonly string[] | null): Promise<string | null> {
  const url = `/api/clients/${clientId}/dashboard-layout`;
  const response = await fetch(url, {
    method: cards ? "PUT" : "DELETE",
    headers: cards ? { "Content-Type": "application/json" } : undefined,
    body: cards ? JSON.stringify({ cards }) : undefined,
  });
  if (response.ok) return null;
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? `Falha ao salvar (HTTP ${response.status}).`;
}

export function CardLayoutEditor({ model, onClose }: Props) {
  const router = useRouter();
  const [draft, setDraft] = useState<string[]>(model.activeCards);
  const [followsDefault, setFollowsDefault] = useState(model.source === "default");
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const dirty = !sameCards(draft, model.activeCards) || followsDefault !== (model.source === "default");
  const usingDefault = followsDefault && sameCards(draft, model.defaultCards);
  const label = (slug: string) => CARD_BY_SLUG.get(slug)?.label ?? slug;

  const update = (next: string[], message: string) => {
    setDraft(next);
    setFollowsDefault(false);
    setAnnouncement(message);
    setError("");
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= draft.length) return;
    update(moveItem(draft, from, to), `${label(draft[from])} na posição ${to + 1} de ${draft.length}.`);
  };

  const remove = (index: number) =>
    update(draft.filter((_, i) => i !== index), `${label(draft[index])} removido.`);

  const add = (slug: string) => {
    if (draft.includes(slug) || draft.length >= MAX_CARDS) return;
    update([...draft, slug], `${label(slug)} adicionado no fim.`);
  };

  const restore = () => {
    setDraft(model.defaultCards);
    setFollowsDefault(true);
    setAnnouncement(`${model.defaultLabel} restaurado.`);
    setError("");
  };

  const requestClose = (open: boolean) => {
    if (open || saving) return;
    if (dirty && !window.confirm("Descartar as alterações desta visão?")) return;
    onClose();
  };

  const save = async () => {
    if (draft.length === 0) {
      setError("Escolha pelo menos uma métrica.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const failure = await persist(model.clientId, usingDefault ? null : draft);
      if (failure) {
        setError(failure);
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setError("Sem conexão com o servidor. Tente de novo.");
    } finally {
      setSaving(false);
    }
  };

  const onDrop = (event: DragEvent<HTMLLIElement>, to: number) => {
    event.preventDefault();
    if (dragFrom !== null) move(dragFrom, to);
    setDragFrom(null);
  };

  return (
    <Sheet open onOpenChange={requestClose}>
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="pr-10">Personalizar visão de {model.clientName}</SheetTitle>
          <SheetDescription>
            Escolha e ordene os cards da Visão geral. A escolha vale só para este cliente.
          </SheetDescription>
          <p className="text-xs font-medium text-primary">
            {usingDefault ? model.defaultLabel : "Visão personalizada"}
          </p>
        </SheetHeader>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {!model.layoutAvailable && (
            <p role="alert" className="rounded-lg border border-warning/30 bg-warning-dim p-3 text-xs text-warning">
              A tabela de layouts ainda não existe no banco. Dá para montar a visão, mas salvar só funciona depois da migração.
            </p>
          )}

          <section aria-labelledby="card-order-title" className="space-y-3">
            <div className="flex items-baseline justify-between gap-2">
              <h3 id="card-order-title" className="text-sm font-semibold text-foreground">
                Cards na visão
              </h3>
              <span className="text-xs tabular-nums text-text-secondary">
                {draft.length} de {MAX_CARDS}
              </span>
            </div>
            {draft.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-text-muted">
                Nenhum card. Adicione uma métrica abaixo.
              </p>
            ) : (
              <ol className="space-y-2">
                {draft.map((slug, index) => (
                  <li
                    key={slug}
                    draggable
                    onDragStart={(event) => {
                      setDragFrom(index);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => onDrop(event, index)}
                    onDragEnd={() => setDragFrom(null)}
                    className={`flex items-center gap-2 rounded-lg border bg-card py-1.5 pl-2 pr-1.5 ${
                      dragFrom === index ? "border-primary opacity-60" : "border-border"
                    }`}
                  >
                    <GripVertical size={16} aria-hidden="true" className="shrink-0 cursor-grab text-text-muted" />
                    <span className="w-5 shrink-0 text-xs tabular-nums text-text-muted">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{label(slug)}</p>
                      <p className="truncate text-xs text-text-secondary">
                        {groupLabel(CARD_BY_SLUG.get(slug)?.group ?? "investment")}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon-sm" disabled={index === 0} onClick={() => move(index, index - 1)} aria-label={`Mover ${label(slug)} para cima`}>
                      <ArrowUp aria-hidden="true" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={index === draft.length - 1}
                      onClick={() => move(index, index + 1)}
                      aria-label={`Mover ${label(slug)} para baixo`}
                    >
                      <ArrowDown aria-hidden="true" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" onClick={() => remove(index)} aria-label={`Remover ${label(slug)}`}>
                      <X aria-hidden="true" />
                    </Button>
                  </li>
                ))}
              </ol>
            )}
            <p className="text-xs text-text-muted">Arraste pelo ícone ou use as setas para mudar a ordem.</p>
          </section>

          <CardCatalogPicker selected={draft} onAdd={add} />
          <p aria-live="polite" className="sr-only">
            {announcement}
          </p>
        </div>

        <SheetFooter className="sm:justify-between">
          <Button variant="ghost" onClick={restore} disabled={saving}>
            <RotateCcw aria-hidden="true" />
            Restaurar padrão do objetivo
          </Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            {error && (
              <p role="alert" className="self-center text-xs text-danger">
                {error}
              </p>
            )}
            <Button variant="outline" onClick={() => requestClose(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={save} loading={saving} disabled={!dirty || draft.length === 0 || !model.layoutAvailable}>
              Salvar
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
