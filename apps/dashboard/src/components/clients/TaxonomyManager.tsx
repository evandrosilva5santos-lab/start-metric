"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui";
import { taxonomyKey, useTaxonomy } from "@/hooks/useTaxonomy";
import { TAXONOMY_COLORS, TAXONOMY_LABELS, type TaxonomyItem, type TaxonomyKind } from "@/lib/clients/taxonomy";

const inputClass =
  "h-11 w-full rounded-lg border border-border bg-input px-3 text-sm text-text-primary outline-none placeholder:text-text-muted hover:border-white-hairline-strong focus-visible:ring-2 focus-visible:ring-ring";

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(json.error ?? `Erro ${res.status}`);
  return json;
}

function ColorPicker({ value, onChange, label }: { value: string; onChange: (c: string) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {TAXONOMY_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          role="radio"
          aria-checked={value === color}
          aria-label={color}
          onClick={() => onChange(color)}
          className={`h-7 w-7 rounded-full ring-offset-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${value === color ? "ring-2 ring-fg" : ""}`}
          style={{ backgroundColor: color }}
        />
      ))}
    </div>
  );
}

function ItemRow({ kind, item }: { kind: TaxonomyKind; item: TaxonomyItem }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [color, setColor] = useState(item.color);
  const [error, setError] = useState<string | null>(null);
  const done = () => void queryClient.invalidateQueries({ queryKey: taxonomyKey(kind) });

  const save = useMutation({
    mutationFn: () => send(`/api/taxonomy/${kind}/${item.id}`, "PATCH", { name, color }),
    onSuccess: () => {
      setEditing(false);
      setError(null);
      done();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Erro ao salvar"),
  });
  const remove = useMutation({
    mutationFn: () => send(`/api/taxonomy/${kind}/${item.id}`, "DELETE"),
    onSuccess: done,
    onError: (err) => setError(err instanceof Error ? err.message : "Erro ao apagar"),
  });

  if (editing) {
    return (
      <li className="space-y-2 py-3">
        <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Nome" className={inputClass} maxLength={60} />
        <ColorPicker value={color} onChange={setColor} label={`Cor de ${item.name}`} />
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex gap-2">
          <Button size="sm" loading={save.isPending} onClick={() => save.mutate()}>
            <Check /> Salvar
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditing(false);
              setName(item.name);
              setColor(item.color);
              setError(null);
            }}
          >
            <X /> Cancelar
          </Button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 py-2">
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-sm text-text-primary">{item.name}</span>
      {error && <span className="text-xs text-danger">{error}</span>}
      <button
        type="button"
        onClick={() => setEditing(true)}
        aria-label={`Editar ${item.name}`}
        className="flex h-11 w-11 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-2 hover:text-text-primary lg:h-8 lg:w-8"
      >
        <Pencil size={15} />
      </button>
      <button
        type="button"
        disabled={remove.isPending}
        onClick={() => {
          if (confirm(`Apagar "${item.name}"? Os clientes com ele ficam sem ${TAXONOMY_LABELS[kind].singular.toLowerCase()}.`)) remove.mutate();
        }}
        aria-label={`Apagar ${item.name}`}
        className="flex h-11 w-11 items-center justify-center rounded-lg text-text-secondary hover:bg-danger-tint hover:text-danger lg:h-8 lg:w-8"
      >
        <Trash2 size={15} />
      </button>
    </li>
  );
}

function TaxonomyPanel({ kind, description }: { kind: TaxonomyKind; description: string }) {
  const queryClient = useQueryClient();
  const list = useTaxonomy(kind);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(TAXONOMY_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const labels = TAXONOMY_LABELS[kind];

  const create = useMutation({
    mutationFn: () => send(`/api/taxonomy/${kind}`, "POST", { name, color }),
    onSuccess: () => {
      setName("");
      setError(null);
      void queryClient.invalidateQueries({ queryKey: taxonomyKey(kind) });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Erro ao salvar"),
  });

  return (
    <section className="rounded-lg border border-border bg-card p-4 md:p-5">
      <h2 className="font-display text-base font-semibold text-fg">{labels.plural}</h2>
      <p className="mt-0.5 text-xs text-fg-muted">{description}</p>

      <form
        className="mt-4 space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) create.mutate();
        }}
      >
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`Novo ${labels.singular.toLowerCase()}`}
            aria-label={`Nome do novo ${labels.singular.toLowerCase()}`}
            maxLength={60}
            className={inputClass}
          />
          <Button type="submit" loading={create.isPending} disabled={!name.trim()} className="h-11 shrink-0">
            <Plus /> Adicionar
          </Button>
        </div>
        <ColorPicker value={color} onChange={setColor} label={`Cor do novo ${labels.singular.toLowerCase()}`} />
        {error && <p role="alert" className="text-xs text-danger">{error}</p>}
      </form>

      {list.isPending ? (
        <div className="mt-4 h-24 animate-pulse rounded-lg bg-surface-2 motion-reduce:animate-none" />
      ) : list.isError ? (
        <p role="alert" className="mt-4 text-sm text-danger">{list.error.message}</p>
      ) : list.data.length === 0 ? (
        <p className="mt-4 rounded-md bg-surface-2 p-4 text-center text-sm text-fg-muted">Nenhum ainda.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {list.data.map((item) => (
            <ItemRow key={item.id} kind={kind} item={item} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function TaxonomyManager() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <TaxonomyPanel kind="segments" description="Ramo do cliente (ex.: Imobiliário, Saúde, Educação)." />
      <TaxonomyPanel kind="products" description="O que a agência entrega para o cliente (ex.: Tráfego, Tráfego + Social)." />
    </div>
  );
}
