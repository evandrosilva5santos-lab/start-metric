"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, Search } from "lucide-react";
import { Button, Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui";
import { AccountGroupList } from "@/components/meta/AccountGroupList";
import { filterAccountGroups, type AccountGroup, type DiscoveredAccount } from "@/lib/meta/account-groups";

type DiscoverResponse = { groups?: AccountGroup[]; error?: string; code?: string };

class DiscoverError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
  }
}

export const DISCOVER_QUERY_KEY = ["meta", "discover"] as const;

async function fetchDiscovery(fresh: boolean, signal?: AbortSignal): Promise<AccountGroup[]> {
  const res = await fetch(`/api/meta/discover${fresh ? "?fresh=true" : ""}`, { signal });
  const json = (await res.json().catch(() => ({}))) as DiscoverResponse;
  if (!res.ok) throw new DiscoverError(json.error || "Não deu para buscar as contas na Meta.", json.code);
  return json.groups ?? [];
}

async function selectAccounts(externalIds: string[]): Promise<void> {
  const res = await fetch("/api/meta/accounts/select", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ externalIds }),
  });
  const json = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(json.error || "Não deu para adicionar as contas.");
}

function AccountBadges({ account }: { account: DiscoveredAccount }) {
  return (
    <span className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
      {account.inPanel && (
        <span className="rounded-full border border-primary/30 bg-accent px-2 py-0.5 text-[11px] font-medium text-accent-foreground">
          Já no painel
        </span>
      )}
      {account.hidden && (
        <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
          Removida do painel
        </span>
      )}
      {account.clientName && (
        <span
          className="max-w-[160px] truncate rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
          title={`Ligada a ${account.clientName}`}
        >
          Ligada a {account.clientName}
        </span>
      )}
    </span>
  );
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (count: number) => void;
};

export function MetaAccountPicker({ open, onOpenChange, onSaved }: Props) {
  const [fresh, setFresh] = useState(false);
  const discovery = useQuery({
    queryKey: [...DISCOVER_QUERY_KEY, fresh],
    queryFn: ({ signal }) => fetchDiscovery(fresh, signal),
    enabled: open,
    retry: false,
    retryOnMount: false,
    staleTime: 60 * 1000,
  });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const groups = useMemo(() => filterAccountGroups(discovery.data ?? [], search), [discovery.data, search]);
  const total = useMemo(() => (discovery.data ?? []).reduce((sum, group) => sum + group.accounts.length, 0), [discovery.data]);
  const error = discovery.error as DiscoverError | null;

  function setMany(ids: string[], checked: boolean) {
    setSaveError(null);
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    try {
      await selectAccounts([...selected]);
      const count = selected.size;
      setSelected(new Set());
      onSaved(count);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Adicionar contas ao painel</SheetTitle>
          <SheetDescription>
            Escolha só as contas que você quer acompanhar. As demais continuam disponíveis aqui para quando precisar.
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-2 border-b border-border p-4 sm:flex-row">
          <label className="relative flex-1">
            <span className="sr-only">Buscar por conta, número ou gerenciador</span>
            <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Conta, act_… ou gerenciador"
              className="h-11 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <Button
            variant="outline"
            className="h-11"
            onClick={() => (fresh ? void discovery.refetch() : setFresh(true))}
            disabled={discovery.isFetching}
          >
            <RefreshCw size={16} aria-hidden="true" className={discovery.isFetching ? "animate-spin motion-reduce:animate-none" : ""} />
            Atualizar lista
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-4" aria-live="polite">
          {discovery.isLoading ? (
            <div className="space-y-2" aria-busy="true" aria-label="Buscando contas na Meta">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="h-14 animate-pulse rounded-lg bg-muted motion-reduce:animate-none" />
              ))}
            </div>
          ) : error ? (
            <div role="alert" className="rounded-lg border border-warning/30 bg-warning-tint p-4 text-sm">
              <p className="font-semibold text-warning">{error.message}</p>
              {error.code === "meta_not_connected" || error.code === "meta_token_expired" ? (
                <a
                  href="/api/meta/oauth"
                  className="mt-3 inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-4 font-semibold text-primary-foreground hover:bg-primary-hover"
                >
                  {error.code === "meta_token_expired" ? "Reconectar Meta" : "Conectar Meta"}
                </a>
              ) : (
                <Button variant="outline" className="mt-3 h-11" onClick={() => void discovery.refetch()}>
                  Tentar de novo
                </Button>
              )}
            </div>
          ) : (
            <>
              <p className="mb-3 text-xs text-muted-foreground">
                <span className="tabular-nums">{groups.reduce((sum, group) => sum + group.accounts.length, 0)}</span> de{" "}
                <span className="tabular-nums">{total}</span> contas que a sua conexão Meta enxerga
              </p>
              <AccountGroupList
                key={search ? "search" : "all"}
                groups={groups}
                selected={selected}
                onToggle={(id) => setMany([id], !selected.has(id))}
                onSetMany={setMany}
                isLocked={(account) => account.inPanel}
                renderBadges={(account) => <AccountBadges account={account} />}
                expandAll={search.trim().length > 0}
                emptyText={total === 0 ? "A sua conexão Meta não enxerga nenhuma conta de anúncio." : "Nenhuma conta com esse nome ou número."}
              />
            </>
          )}
        </div>

        {saveError && (
          <p role="alert" className="mx-4 mb-2 rounded-lg border border-danger/30 bg-danger-tint p-3 text-sm text-danger">
            {saveError}
          </p>
        )}

        <SheetFooter className="sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold tabular-nums text-foreground">{selected.size}</span>{" "}
            {selected.size === 1 ? "conta selecionada" : "contas selecionadas"}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="h-11 flex-1 sm:flex-none" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button className="h-11 flex-1 sm:flex-none" loading={saving} disabled={selected.size === 0} onClick={() => void save()}>
              Adicionar ao painel
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
