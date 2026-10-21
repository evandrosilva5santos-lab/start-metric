"use client";

import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Clock, Database, ExternalLink, Info, RefreshCw, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PanelMetaAccount } from "./types";

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: LucideIcon }> = {
  active: { label: "Ativa", className: "bg-success-tint text-success border-success/20", icon: CheckCircle2 },
  expired: { label: "Expirada", className: "bg-warning-tint text-warning border-warning/20", icon: Clock },
  disconnected: { label: "Desconectada", className: "bg-subtle text-fg-muted border-border-strong", icon: AlertCircle },
};

type Props = {
  account: PanelMetaAccount;
  index: number;
  isSelected: boolean;
  isSyncing: boolean;
  isDeleting: boolean;
  onSelect: (checked: boolean) => void;
  onSync: () => void;
  onDelete: () => void;
};

export function MetaAccountCard({ account, index, isSelected, isSyncing, isDeleting, onSelect, onSync, onDelete }: Props) {
  const config = STATUS_CONFIG[account.status] ?? STATUS_CONFIG.disconnected;
  const StatusIcon = config.icon;
  const expiresAt = account.token_expires_at ? new Date(account.token_expires_at) : null;
  const isExpired = expiresAt ? expiresAt < new Date() : false;
  const displayName = account.name ?? account.external_id;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 10) * 0.05 }}
      className={`group/card relative overflow-hidden rounded-[16px] border bg-surface transition-colors ${
        isSelected ? "border-primary/60" : "border-border hover:border-primary/30"
      }`}
    >
      <div className="relative z-10 flex flex-col justify-between gap-4 p-4 md:flex-row md:items-center md:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <label className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg hover:bg-subtle">
            <span className="sr-only">Selecionar {displayName}</span>
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(event) => onSelect(event.target.checked)}
              className="h-4 w-4 accent-primary"
            />
          </label>
          <div className="relative hidden shrink-0 sm:block">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-subtle text-fg-muted transition-colors group-hover/card:text-primary">
              <Database size={20} aria-hidden="true" />
            </div>
            {isSyncing && <div className="absolute inset-0 animate-ping rounded-xl border-2 border-primary opacity-20 motion-reduce:animate-none" />}
          </div>

          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-base font-semibold tracking-tight text-fg" title={displayName}>
                {displayName}
              </h3>
              <span className={`flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium ${config.className}`}>
                <StatusIcon size={12} aria-hidden="true" />
                {config.label}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-muted">
              <span className="flex items-center gap-1 font-mono tabular-nums">
                <Info size={12} aria-hidden="true" />
                {account.external_id}
              </span>
              <span>{account.currency ?? "—"}</span>
              <span>{account.client_name ? `Cliente: ${account.client_name}` : "Sem cliente ligado"}</span>
              {expiresAt && (
                <span className={`flex items-center gap-1 ${isExpired ? "text-warning" : ""}`}>
                  <Clock size={12} aria-hidden="true" />
                  {isExpired ? "Expirou em " : "Expira em "}
                  {expiresAt.toLocaleDateString("pt-BR")}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-border bg-surface p-1">
            {account.status === "expired" ? (
              <a
                href="/api/meta/oauth"
                className="flex h-11 items-center gap-2 rounded-lg border border-warning/20 bg-warning-tint px-4 text-sm font-semibold text-warning transition-colors hover:bg-warning/20 lg:h-10"
              >
                <RefreshCw size={14} aria-hidden="true" />
                Revalidar
              </a>
            ) : (
              <button
                type="button"
                onClick={onSync}
                disabled={isSyncing}
                className={`flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors lg:h-10 ${
                  isSyncing ? "cursor-not-allowed bg-primary-tint text-primary" : "border border-border bg-subtle text-fg hover:bg-primary-hover hover:text-primary-fg"
                }`}
              >
                <RefreshCw size={14} aria-hidden="true" className={isSyncing ? "animate-spin motion-reduce:animate-none" : ""} />
                {isSyncing ? "Sincronizando…" : "Sincronizar"}
              </button>
            )}

            <button
              type="button"
              onClick={onDelete}
              disabled={isDeleting}
              aria-label={`Excluir ${displayName} e o histórico sincronizado`}
              title="Excluir conta e histórico sincronizado"
              className="flex size-11 items-center justify-center rounded-lg text-fg-muted transition-colors hover:bg-danger-tint hover:text-danger disabled:opacity-50 lg:size-10"
            >
              {isDeleting ? <RefreshCw size={14} className="animate-spin text-danger motion-reduce:animate-none" /> : <Trash2 size={16} aria-hidden="true" />}
            </button>
          </div>

          <a
            href={`https://adsmanager.facebook.com/adsmanager/manage/campaigns?act=${account.external_id}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Abrir ${displayName} no Gerenciador de Anúncios`}
            title="Abrir no Gerenciador de Anúncios"
            className="flex size-11 items-center justify-center rounded-xl border border-border bg-surface text-fg-muted transition-colors hover:text-fg lg:size-10"
          >
            <ExternalLink size={16} aria-hidden="true" />
          </a>
        </div>
      </div>
    </motion.div>
  );
}
