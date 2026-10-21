"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Link2, Search } from "lucide-react";
import { Button } from "@/components/ui";
import { AccountGroupList } from "@/components/meta/AccountGroupList";
import { filterAccountGroups, type AccountGroup } from "@/lib/meta/account-groups";
import { ApiError, clientMetaAccountsKey, fetchClientMetaAccounts, saveClientAccounts } from "./client-meta-accounts";

type Props = {
  clientId: string;
  linkedIds: string[];
  onClose: () => void;
  onSaved: (count: number) => Promise<void>;
};

export function ClientAccountSearch({ clientId, linkedIds, onClose, onSaved }: Props) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(linkedIds));
  const [search, setSearch] = useState("");
  const [onlyFree, setOnlyFree] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmReassignment, setConfirmReassignment] = useState(false);

  // O pai só monta este painel quando a consulta não está carregando; refazer a busca ao montar
  // reabria o carregamento, desmontava o painel e repetia em loop quando a API devolvia erro.
  const candidates = useQuery({
    queryKey: clientMetaAccountsKey(clientId),
    queryFn: ({ signal }) => fetchClientMetaAccounts(clientId, signal),
    retry: false,
    retryOnMount: false,
    staleTime: 60 * 1000,
  });

  const accounts = useMemo(() => candidates.data?.contas ?? [], [candidates.data]);
  const ownerById = useMemo(() => new Map(accounts.map((acc) => [acc.id, acc])), [accounts]);

  const groups = useMemo<AccountGroup[]>(() => {
    const searched = filterAccountGroups(candidates.data?.grupos ?? [], search);
    if (!onlyFree) return searched;
    return searched.flatMap((group) => {
      const free = group.accounts.filter((account) => {
        const ownerId = ownerById.get(account.externalId)?.clientId;
        return !ownerId || ownerId === clientId;
      });
      return free.length > 0 ? [{ ...group, accounts: free }] : [];
    });
  }, [candidates.data, search, onlyFree, ownerById, clientId]);

  const shownCount = groups.reduce((sum, group) => sum + group.accounts.length, 0);

  function setMany(ids: string[], checked: boolean) {
    setConfirmReassignment(false);
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
      await saveClientAccounts(clientId, [...selected], confirmReassignment);
      await onSaved(selected.size);
    } catch (err) {
      if (err instanceof ApiError && err.code === "reassignment_confirmation_required") {
        setConfirmReassignment(true);
        setSaveError("Confirme abaixo para mover as contas indicadas de outro cliente.");
      } else {
        setSaveError(err instanceof Error ? err.message : "Erro ao salvar.");
      }
    } finally {
      setSaving(false);
    }
  }

  const error = candidates.error as ApiError | null;
  const movingCount = accounts.filter((a) => selected.has(a.id) && a.clientId && a.clientId !== clientId).length;

  function renderBadges(externalId: string, checked: boolean) {
    const owner = ownerById.get(externalId);
    const otherOwner = owner?.clientId && owner.clientId !== clientId ? owner.clientName : null;
    return (
      <span className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
        {owner?.hidden && (
          <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold text-text-secondary">
            fora do painel
          </span>
        )}
        {otherOwner && (
          <span
            className={`max-w-[160px] truncate rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
              checked ? "border-warning/30 bg-warning-dim text-warning" : "border-border text-text-secondary"
            }`}
            title={checked ? `Vai sair de ${otherOwner}` : `Ligada a ${otherOwner}`}
          >
            {checked ? `sai de ${otherOwner}` : `de ${otherOwner}`}
          </span>
        )}
      </span>
    );
  }

  return (
    <div className="border-b border-border bg-surface-2/40 p-4 md:p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <span className="sr-only">Buscar conta pelo nome, número ou gerenciador</span>
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Conta, act_… ou gerenciador"
            autoFocus
            className="h-11 w-full rounded-lg border border-border bg-input pl-9 pr-3 text-sm text-text-primary outline-none placeholder:text-text-muted hover:border-white-hairline-strong focus-visible:ring-2 focus-visible:ring-ring"
          />
        </label>
        <label className="flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm text-text-secondary">
          <input
            type="checkbox"
            checked={onlyFree}
            onChange={(e) => setOnlyFree(e.target.checked)}
            className="h-4 w-4 accent-primary"
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
            {(error.code === "meta_unavailable" || error.code === "meta_rate_limited" || error.code === "rate_limited") && (
              <Button variant="outline" className="mt-3 h-11" onClick={() => void candidates.refetch()}>
                Tentar de novo
              </Button>
            )}
          </div>
        ) : (
          <>
            <p className="mb-2 text-xs text-text-muted">
              <span className="tabular-nums">{shownCount}</span> de <span className="tabular-nums">{accounts.length}</span> contas
              do painel. Para liberar outra conta,{" "}
              <Link href="/settings/meta?adicionar=1" className="font-semibold text-primary hover:underline">
                adicione em Integrações → Meta Ads
              </Link>
              .
            </p>
            <div className="max-h-[420px] overflow-y-auto">
              <AccountGroupList
                key={search || onlyFree ? "filtered" : "all"}
                groups={groups}
                selected={selected}
                onToggle={(id) => setMany([id], !selected.has(id))}
                onSetMany={setMany}
                renderBadges={(account, checked) => renderBadges(account.externalId, checked)}
                expandAll={search.trim().length > 0}
                emptyText={accounts.length === 0 ? "Nenhuma conta no painel ainda." : "Nenhuma conta com esse nome."}
              />
            </div>
          </>
        )}
      </div>

      {saveError && (
        <p role="alert" className="mt-3 rounded-lg border border-danger/30 bg-danger-dim p-3 text-sm text-danger">
          {saveError}
        </p>
      )}

      {confirmReassignment && movingCount > 0 ? (
        <p role="alert" className="mt-3 rounded-lg border border-warning/30 bg-warning-dim p-3 text-sm text-warning">
          Esta ação moverá {movingCount} conta{movingCount === 1 ? "" : "s"} para este cliente. O vínculo anterior será substituído.
        </p>
      ) : null}

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
          <Button
            onClick={() => void save()}
            loading={saving}
            disabled={!candidates.data}
            variant={confirmReassignment ? "danger" : "default"}
            className="h-11 flex-1 sm:flex-none"
          >
            {confirmReassignment ? "Confirmar reatribuição" : "Salvar contas"}
          </Button>
        </div>
      </div>
    </div>
  );
}
