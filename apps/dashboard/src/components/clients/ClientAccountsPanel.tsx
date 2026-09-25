"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, Search, X } from "lucide-react";
import { Button } from "@/components/ui";
import { useMetaAccounts } from "@/hooks/useMetaDashboard";

type CandidateAccount = {
  id: string;
  name: string;
  currency: string;
  isActive: boolean;
  clientId: string | null;
  clientName: string | null;
};

type CandidatesResponse = { contas?: CandidateAccount[]; error?: string; code?: string };

class ApiError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
  }
}

async function saveClientAccounts(clientId: string, externalIds: string[]) {
  const res = await fetch(`/api/clients/${clientId}/accounts`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ external_ids: externalIds }),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(json.error || "Não deu para salvar as contas.");
}

export function ClientAccountsPanel({
  clientId,
  clientName,
  startOpen = false,
}: {
  clientId: string;
  clientName: string;
  startOpen?: boolean;
}) {
  const queryClient = useQueryClient();
  const { accounts, isLoading } = useMetaAccounts();
  const [searchOpen, setSearchOpen] = useState(startOpen);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const linked = useMemo(() => accounts.filter((a) => a.clientId === clientId), [accounts, clientId]);

  async function refreshAll() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["meta", "contas"] }),
      queryClient.invalidateQueries({ queryKey: ["client-meta-accounts", clientId] }),
    ]);
  }

  async function unlink(accountId: string) {
    setRemoving(accountId);
    setMessage(null);
    try {
      await saveClientAccounts(
        clientId,
        linked.filter((a) => a.id !== accountId).map((a) => a.id),
      );
      await refreshAll();
      setMessage({ type: "success", text: "Conta solta. Ela agora aparece em “Sem cliente”." });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Erro ao soltar a conta." });
    } finally {
      setRemoving(null);
    }
  }

  return (
    <section aria-labelledby="client-accounts-title" className="rounded-lg border border-border bg-card">
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between md:p-5">
        <div>
          <h2 id="client-accounts-title" className="font-display text-base font-semibold text-foreground">
            Contas de anúncio
          </h2>
          <p className="mt-0.5 text-xs text-text-secondary">
            As contas ligadas aqui aparecem no topo quando você escolhe {clientName}.
          </p>
        </div>
        {!searchOpen && (
          <Button onClick={() => setSearchOpen(true)} className="h-11 shrink-0">
            <Search size={16} />
            Buscar contas de anúncio
          </Button>
        )}
      </div>

      {message && (
        <p
          role={message.type === "error" ? "alert" : "status"}
          className={`mx-4 mt-4 rounded-lg border p-3 text-sm md:mx-5 ${
            message.type === "success" ? "border-primary/30 bg-primary-dim text-primary" : "border-danger/30 bg-danger-dim text-danger"
          }`}
        >
          {message.text}
        </p>
      )}

      {searchOpen && !isLoading && (
        <AccountSearch
          clientId={clientId}
          linkedIds={linked.map((a) => a.id)}
          onClose={() => setSearchOpen(false)}
          onSaved={async (count) => {
            await refreshAll();
            setSearchOpen(false);
            setMessage({
              type: "success",
              text: count === 1 ? "1 conta ligada ao cliente." : `${count} contas ligadas ao cliente.`,
            });
          }}
        />
      )}

      <div className="p-4 md:p-5">
        {isLoading ? (
          <div className="h-16 animate-pulse rounded-lg bg-surface-2 motion-reduce:animate-none" />
        ) : linked.length === 0 ? (
          <p className="text-sm text-text-muted">Nenhuma conta ligada ainda. Use “Buscar contas de anúncio”.</p>
        ) : (
          <ul className="divide-y divide-border">
            {linked.map((acc) => (
              <li key={acc.id} className="flex items-center gap-3 py-2.5">
                <span
                  aria-hidden="true"
                  className={`h-2 w-2 shrink-0 rounded-full ${acc.isActive ? "bg-primary" : "bg-text-muted"}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground" title={acc.name}>
                    {acc.name}
                  </p>
                  <p className="text-xs tabular-nums text-text-muted">
                    {acc.id} · {acc.currency}
                    {acc.isActive ? "" : " · inativa"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void unlink(acc.id)}
                  disabled={removing === acc.id}
                  aria-label={`Soltar ${acc.name} deste cliente`}
                  className="flex h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm text-text-secondary hover:bg-surface-2 hover:text-danger disabled:opacity-50"
                >
                  <X size={15} />
                  <span className="hidden sm:inline">Soltar</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function AccountSearch({
  clientId,
  linkedIds,
  onClose,
  onSaved,
}: {
  clientId: string;
  linkedIds: string[];
  onClose: () => void;
  onSaved: (count: number) => Promise<void>;
}) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(linkedIds));
  const [search, setSearch] = useState("");
  const [onlyFree, setOnlyFree] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const candidates = useQuery({
    queryKey: ["client-meta-accounts", clientId],
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/clients/${clientId}/meta-accounts`, { signal });
      const json = (await res.json().catch(() => ({}))) as CandidatesResponse;
      if (!res.ok) throw new ApiError(json.error || "Não deu para buscar as contas.", json.code);
      return json.contas ?? [];
    },
    retry: false,
    staleTime: 60 * 1000,
  });

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (candidates.data ?? []).filter((acc) => {
      if (onlyFree && acc.clientId && acc.clientId !== clientId) return false;
      if (!q) return true;
      return acc.name.toLowerCase().includes(q) || acc.id.includes(q);
    });
  }, [candidates.data, search, onlyFree, clientId]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      await saveClientAccounts(clientId, [...selected]);
      await onSaved(selected.size);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  const error = candidates.error as ApiError | null;
  const movingCount = (candidates.data ?? []).filter(
    (a) => selected.has(a.id) && a.clientId && a.clientId !== clientId,
  ).length;

  return (
    <div className="border-b border-border bg-surface-2/40 p-4 md:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Buscar conta pelo nome ou número</span>
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nome da conta ou act_…"
            autoFocus
            className="h-11 w-full rounded-lg border border-border bg-input pl-9 pr-3 text-sm text-text-primary outline-none placeholder:text-text-muted hover:border-white-hairline-strong focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <label className="flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={onlyFree}
            onChange={(e) => setOnlyFree(e.target.checked)}
            className="h-4 w-4 accent-[#44d5a4]"
          />
          Só sem cliente
        </label>
      </div>

      <div className="mt-3">
        {candidates.isLoading ? (
          <div className="space-y-2" aria-busy="true" aria-label="Buscando contas na Meta">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-surface-2 motion-reduce:animate-none" />
            ))}
          </div>
        ) : error ? (
          <div role="alert" className="rounded-lg border border-warning/30 bg-warning-dim p-4 text-sm">
            <p className="font-semibold text-warning">{error.message}</p>
            {(error.code === "meta_not_connected" || error.code === "meta_token_expired") && (
              <Link
                href="/settings/meta"
                className="mt-3 inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary-bright"
              >
                <Link2 size={16} /> Conectar Meta Ads
              </Link>
            )}
            {error.code === "meta_unavailable" && (
              <Button variant="outline" className="mt-3 h-11" onClick={() => void candidates.refetch()}>
                Tentar de novo
              </Button>
            )}
          </div>
        ) : (
          <>
            <p className="mb-2 text-xs text-text-muted">
              <span className="tabular-nums">{list.length}</span> de{" "}
              <span className="tabular-nums">{candidates.data?.length ?? 0}</span> contas da sua conexão Meta
            </p>
            <ul className="max-h-[380px] divide-y divide-border overflow-y-auto rounded-lg border border-border bg-card">
              {list.length === 0 ? (
                <li className="p-4 text-center text-sm text-text-muted">Nenhuma conta com esse nome.</li>
              ) : (
                list.map((acc) => {
                  const checked = selected.has(acc.id);
                  const otherOwner = acc.clientId && acc.clientId !== clientId ? acc.clientName : null;
                  return (
                    <li key={acc.id}>
                      <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-surface-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(acc.id)}
                          className="h-4 w-4 shrink-0 accent-[#44d5a4]"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-foreground" title={acc.name}>
                            {acc.name}
                          </span>
                          <span className="block truncate text-xs tabular-nums text-text-muted">
                            {acc.id} · {acc.currency}
                            {acc.isActive ? "" : " · inativa"}
                          </span>
                        </span>
                        {otherOwner && (
                          <span
                            className={`shrink-0 truncate rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                              checked ? "border-warning/30 bg-warning-dim text-warning" : "border-border text-text-secondary"
                            }`}
                            title={checked ? `Vai sair de ${otherOwner}` : `Ligada a ${otherOwner}`}
                          >
                            {checked ? `sai de ${otherOwner}` : `de ${otherOwner}`}
                          </span>
                        )}
                      </label>
                    </li>
                  );
                })
              )}
            </ul>
          </>
        )}
      </div>

      {saveError && (
        <p role="alert" className="mt-3 rounded-lg border border-danger/30 bg-danger-dim p-3 text-sm text-danger">
          {saveError}
        </p>
      )}

      <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-text-secondary">
          <span className="font-semibold tabular-nums text-foreground">{selected.size}</span> selecionadas
          {movingCount > 0 && (
            <span className="text-warning">
              {" "}
              · <span className="tabular-nums">{movingCount}</span> mudam de cliente
            </span>
          )}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} className="h-11 flex-1 sm:flex-none">
            Cancelar
          </Button>
          <Button onClick={() => void save()} loading={saving} disabled={!candidates.data} className="h-11 flex-1 sm:flex-none">
            Salvar contas
          </Button>
        </div>
      </div>
    </div>
  );
}
