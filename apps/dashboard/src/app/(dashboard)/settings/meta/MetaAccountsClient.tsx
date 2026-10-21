"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AlertCircle, Facebook, Link2, ListPlus, Plus, RefreshCw } from "lucide-react";
import { MetaAccountCard } from "./MetaAccountCard";
import { MetaAccountPicker, DISCOVER_QUERY_KEY } from "./MetaAccountPicker";
import { MetaFlashMessages } from "./MetaFlashMessages";
import { PanelSelectionBar } from "./PanelSelectionBar";
import { useMetaAccountActions } from "./useMetaAccountActions";
import type { MetaConnectionSummary, PanelMetaAccount } from "./types";

type Props = {
  accounts: PanelMetaAccount[];
  connection: MetaConnectionSummary | null;
  flashConnected?: boolean;
  flashError?: string;
  openPicker?: boolean;
};

const ERROR_MESSAGES: Record<string, string> = {
  oauth_denied: "Você cancelou a conexão com a Meta.",
  missing_params: "Parâmetros inválidos. Tente novamente.",
  invalid_state: "Sessão expirou. Tente novamente.",
  unauthenticated: "Sessão expirou. Faça login novamente.",
  no_organization: "Sua conta não está associada a uma organização.",
  no_ad_accounts: "Nenhuma conta de anúncios encontrada neste perfil Meta.",
  save_failed: "Erro ao salvar a conexão. Tente novamente.",
  unexpected: "Erro inesperado. Tente novamente em instantes.",
};

export default function MetaAccountsClient({ accounts, connection, flashConnected = false, flashError, openPicker = false }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [sourceAccounts, setSourceAccounts] = useState(accounts);
  const [localAccounts, setLocalAccounts] = useState<PanelMetaAccount[]>(accounts);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [pickerOpen, setPickerOpen] = useState(openPicker);

  if (accounts !== sourceAccounts) {
    setSourceAccounts(accounts);
    setLocalAccounts(accounts);
  }

  const actions = useMetaAccountActions({
    setAccounts: setLocalAccounts,
    onChanged: () => {
      setSelected(new Set());
      void queryClient.invalidateQueries({ queryKey: DISCOVER_QUERY_KEY });
      router.refresh();
    },
  });

  useEffect(() => {
    if (!flashConnected) return;
    const timer = setTimeout(() => router.refresh(), 1500);
    return () => clearTimeout(timer);
  }, [flashConnected, router]);

  const errorMessage = flashError ? ERROR_MESSAGES[flashError] ?? "Erro ao conectar. Tente novamente." : null;
  const isConnected = connection !== null || localAccounts.length > 0;
  const expiredCount = localAccounts.filter((account) => account.status === "expired").length;
  const connectionExpired = connection?.status === "expired";
  const selectedIds = localAccounts.filter((account) => selected.has(account.id)).map((account) => account.id);

  function handlePickerOpenChange(open: boolean) {
    setPickerOpen(open);
    if (!open && openPicker) router.replace("/settings/meta", { scroll: false });
  }

  function handlePickerSaved(count: number) {
    handlePickerOpenChange(false);
    actions.setFeedback({
      type: "success",
      message: count === 1 ? "1 conta adicionada ao painel." : `${count} contas adicionadas ao painel.`,
    });
    void queryClient.invalidateQueries({ queryKey: DISCOVER_QUERY_KEY });
    router.refresh();
  }

  function toggleSelected(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <div className="space-y-8">
      <MetaFlashMessages
        flashConnected={flashConnected}
        errorMessage={errorMessage}
        feedback={actions.feedback}
        onDismiss={() => actions.setFeedback(null)}
      />

      {(expiredCount > 0 || connectionExpired) && (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-panel border border-warning/30 bg-warning-tint p-4 md:flex-row md:items-center md:justify-between"
        >
          <div className="flex items-start gap-3 text-sm">
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
            <p className="text-fg">
              <span className="font-semibold">
                {expiredCount === 0
                  ? "A conexão da organização com a Meta venceu."
                  : expiredCount === 1
                    ? "1 conta está com a conexão da Meta vencida."
                    : `${expiredCount} contas estão com a conexão da Meta vencida.`}
              </span>{" "}
              <span className="text-fg-muted">
                Uma única reconexão renova a conexão da organização e o acesso de todas as contas do painel.
              </span>
            </p>
          </div>
          <a
            href="/api/meta/oauth"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-fg transition-colors hover:bg-primary-hover"
          >
            <RefreshCw size={16} aria-hidden="true" />
            Reconectar todas
          </a>
        </div>
      )}

      {isConnected ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-fg shadow-sm transition-colors hover:bg-primary-hover"
          >
            <ListPlus size={18} aria-hidden="true" />
            Adicionar contas
          </button>
          <a
            href="/api/meta/oauth"
            className="flex h-12 items-center justify-center gap-2 rounded-xl border border-border-strong bg-surface px-6 text-sm font-semibold text-fg transition-colors hover:bg-subtle"
          >
            <Link2 size={16} aria-hidden="true" />
            Atualizar conexão com a Meta
          </a>
        </div>
      ) : (
        <a
          href="/api/meta/oauth"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-8 text-sm font-semibold text-primary-fg shadow-sm transition-colors hover:bg-primary-hover"
        >
          <Plus size={18} aria-hidden="true" />
          Conectar Meta Ads
        </a>
      )}

      <section aria-labelledby="meta-panel-accounts" className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 id="meta-panel-accounts" className="flex items-center gap-2 text-sm font-semibold text-fg">
            <Facebook size={14} className="text-primary" aria-hidden="true" />
            Contas no painel (<span className="tabular-nums">{localAccounts.length}</span>)
          </h2>
          <div className="mx-4 h-px flex-1 bg-subtle" />
          <span className="text-xs text-fg-muted">Sincronização diária</span>
        </div>

        <PanelSelectionBar
          total={localAccounts.length}
          selectedCount={selectedIds.length}
          hiding={actions.hiding}
          conflict={actions.linkedConflict?.linked ?? null}
          onToggleAll={(checked) => setSelected(checked ? new Set(localAccounts.map((account) => account.id)) : new Set())}
          onHide={() => void actions.hide(selectedIds)}
          onConfirmForce={() => void actions.hide(actions.linkedConflict?.ids ?? [], true)}
          onCancelConflict={actions.dismissConflict}
        />

        <div className="grid gap-3">
          {localAccounts.length > 0
            ? localAccounts.map((account, index) => (
                <MetaAccountCard
                  key={account.id}
                  account={account}
                  index={index}
                  isSelected={selected.has(account.id)}
                  isSyncing={actions.syncingId === account.id}
                  isDeleting={actions.deletingId === account.id}
                  onSelect={(checked) => toggleSelected(account.id, checked)}
                  onSync={() => void actions.sync(account)}
                  onDelete={() => void actions.remove(account)}
                />
              ))
            : !errorMessage && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center rounded-[16px] border border-dashed border-border bg-subtle px-6 py-16 text-center"
                >
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-tint text-primary">
                    <Facebook size={28} aria-hidden="true" />
                  </div>
                  <h3 className="mb-2 text-sm font-semibold text-fg">
                    {isConnected ? "Nenhuma conta no painel" : "Nenhuma conexão ativa"}
                  </h3>
                  <p className="mx-auto max-w-xs text-sm leading-relaxed text-fg-muted">
                    {isConnected
                      ? "Escolha as contas que você quer acompanhar. Só elas aparecem no painel e são sincronizadas."
                      : "Conecte seu Gerenciador de Anúncios da Meta e depois escolha quais contas acompanhar."}
                  </p>
                  {isConnected && (
                    <button
                      type="button"
                      onClick={() => setPickerOpen(true)}
                      className="mt-4 inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-fg hover:bg-primary-hover"
                    >
                      <ListPlus size={16} aria-hidden="true" />
                      Adicionar contas
                    </button>
                  )}
                </motion.div>
              )}
        </div>
      </section>

      <MetaAccountPicker open={pickerOpen} onOpenChange={handlePickerOpenChange} onSaved={handlePickerSaved} />
    </div>
  );
}
