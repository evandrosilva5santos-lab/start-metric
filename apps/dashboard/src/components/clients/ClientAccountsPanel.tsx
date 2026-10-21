"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui";
import { ClientAccountSearch } from "./ClientAccountSearch";
import { clientMetaAccountsKey, fetchClientMetaAccounts, saveClientAccounts } from "./client-meta-accounts";

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
  const inventory = useQuery({
    queryKey: clientMetaAccountsKey(clientId),
    queryFn: ({ signal }) => fetchClientMetaAccounts(clientId, signal),
    retry: false,
    staleTime: 60 * 1000,
  });
  const [searchOpen, setSearchOpen] = useState(startOpen);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const linked = useMemo(
    () => (inventory.data?.contas ?? []).filter((account) => account.clientId === clientId),
    [clientId, inventory.data],
  );
  const isLoading = inventory.isLoading;

  async function refreshAll() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["meta", "contas"] }),
      queryClient.invalidateQueries({ queryKey: clientMetaAccountsKey(clientId) }),
      queryClient.invalidateQueries({ queryKey: ["meta", "discover"] }),
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
      setMessage({
        type: "success",
        text: "Conta desvinculada. Ela saiu das telas operacionais e continua disponível na Carteira.",
      });
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
        <ClientAccountSearch
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
                    {acc.hidden ? " · fora do painel" : ""}
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
