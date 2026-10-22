"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Users } from "lucide-react";
import { Button, EmptyState } from "@/components/ui";
import { ClientModal } from "@/components/clients/ClientModal";
import { ClientCard, type ClientCardData } from "@/components/clients/ClientCard";
import { useTaxonomy } from "@/hooks/useTaxonomy";
import type { TaxonomyItem } from "@/lib/clients/taxonomy";

const filterClass =
  "h-11 rounded-lg border border-border bg-input px-3 text-sm text-text-primary outline-none hover:border-white-hairline-strong focus-visible:ring-2 focus-visible:ring-ring";

function byId(items: readonly TaxonomyItem[] | undefined): Map<string, TaxonomyItem> {
  return new Map((items ?? []).map((item) => [item.id, item]));
}

export function ClientsPageClient() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [clients, setClients] = useState<ClientCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ClientCardData | null>(null);
  const [search, setSearch] = useState("");
  const [segmentFilter, setSegmentFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const segments = useTaxonomy("segments");
  const products = useTaxonomy("products");
  const segmentById = useMemo(() => byId(segments.data), [segments.data]);
  const productById = useMemo(() => byId(products.data), [products.data]);

  const fetchClients = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/clients");
      const json = (await res.json()) as { data?: ClientCardData[]; error?: string };
      if (!res.ok) throw new Error(json.error || "Erro ao buscar clientes");
      setClients(json.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao buscar clientes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchClients();
  }, [fetchClients]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients.filter(
      (c) =>
        (!q || c.name.toLowerCase().includes(q) || (c.niche ?? "").toLowerCase().includes(q)) &&
        (!segmentFilter || c.segment_id === segmentFilter) &&
        (!productFilter || c.product_id === productFilter),
    );
  }, [clients, search, segmentFilter, productFilter]);

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  async function handleArchive(clientId: string) {
    if (!confirm("Arquivar este cliente? As contas dele voltam para “Sem cliente”.")) return;
    const res = await fetch(`/api/clients/${clientId}`, { method: "DELETE" });
    if (!res.ok) {
      alert("Não deu para arquivar o cliente.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["meta", "contas"] });
    await fetchClients();
  }

  function handleSaved(saved: { id: string }) {
    const wasCreating = !editing;
    setModalOpen(false);
    setEditing(null);
    void queryClient.invalidateQueries({ queryKey: ["meta", "contas"] });
    if (wasCreating) {
      router.push(`/clients/${saved.id}?buscar=1`);
      return;
    }
    void fetchClients();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">Clientes</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Cadastre o cliente e ligue as contas de anúncio dele. No topo você escolhe o cliente e depois a conta.
          </p>
        </div>
        <Button onClick={openCreate} className="h-11 shrink-0">
          <Plus size={18} />
          Novo cliente
        </Button>
      </div>

      {clients.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <label className="relative block w-full max-w-sm">
            <span className="sr-only">Buscar cliente</span>
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou nicho…"
              className="h-11 w-full rounded-lg border border-border bg-input pl-9 pr-3 text-sm text-text-primary outline-none placeholder:text-text-muted hover:border-white-hairline-strong focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          {(segments.data?.length ?? 0) > 0 && (
            <select aria-label="Filtrar por segmento" value={segmentFilter} onChange={(e) => setSegmentFilter(e.target.value)} className={filterClass}>
              <option value="">Todos os segmentos</option>
              {segments.data?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          {(products.data?.length ?? 0) > 0 && (
            <select aria-label="Filtrar por produto" value={productFilter} onChange={(e) => setProductFilter(e.target.value)} className={filterClass}>
              <option value="">Todos os produtos</option>
              {products.data?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-[196px] animate-pulse rounded-lg bg-surface-2 motion-reduce:animate-none" />
          ))}
        </div>
      ) : error ? (
        <div role="alert" className="rounded-lg border border-danger/30 bg-danger-dim p-5">
          <p className="text-sm text-danger">{error}</p>
          <Button variant="outline" className="mt-3 h-11" onClick={() => void fetchClients()}>
            Tentar de novo
          </Button>
        </div>
      ) : clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum cliente ainda"
          description="Cadastre o primeiro cliente com nome, nicho e WhatsApp. Depois, busque as contas de anúncio dele."
          action={{ label: "Cadastrar cliente", onClick: openCreate }}
        />
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-text-muted">Nenhum cliente com esse filtro.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((client) => (
            <ClientCard
              key={client.id}
              client={client}
              segment={client.segment_id ? segmentById.get(client.segment_id) : null}
              product={client.product_id ? productById.get(client.product_id) : null}
              onEdit={(c) => {
                setEditing(c);
                setModalOpen(true);
              }}
              onArchive={(id) => void handleArchive(id)}
            />
          ))}
        </ul>
      )}

      {modalOpen && (
        <ClientModal
          isOpen={modalOpen}
          client={editing}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
