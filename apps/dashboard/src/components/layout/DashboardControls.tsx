"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import { clientOf, useMetaAccounts, useMetaDados } from "@/hooks/useMetaDashboard";
import { AccountCombobox } from "@/components/shared/AccountCombobox";
import {
  LIVE_OPTIONS,
  RANGE_OPTIONS,
  useDashboardFilters,
  type AdsPlatform,
  type LiveInterval,
  type RangeValue,
} from "@/store/dashboard-filters";

const selectClass =
  "h-11 cursor-pointer rounded-md border border-border-strong bg-surface px-2.5 text-[16px] text-fg outline-none transition-colors hover:bg-subtle focus-visible:ring-2 focus-visible:ring-ring md:text-[13px] lg:h-8";

const iconButtonClass =
  "flex size-11 shrink-0 items-center justify-center rounded-md border border-border-strong bg-surface text-fg-muted transition-colors hover:bg-subtle hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 lg:size-8";

function useOnlineStatus() {
  const [online, setOnline] = useState(() => (typeof navigator !== "undefined" ? navigator.onLine : true));
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);
  return online;
}

function formatExactTime(updatedAt: number): string {
  if (!updatedAt) return "";
  return new Date(updatedAt).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export type ControlsStatus = {
  isFetching: boolean;
  isError: boolean;
  updatedAt: number;
  canRefresh: boolean;
  refresh: () => void;
  fetchingTitle: string;
  refreshLabel: string;
};

export type ScopeChange = { clientId: string; accountId: string; range: string };

export const ALL_ACCOUNTS = "all";

function LiveBadge({
  live,
  isError,
  isFetching,
  updatedAt,
  isOnline,
  fetchingTitle,
  onRefresh,
}: {
  live: boolean;
  isError: boolean;
  isFetching: boolean;
  updatedAt: number;
  isOnline: boolean;
  fetchingTitle: string;
  onRefresh: () => void;
}) {
  const time = formatExactTime(updatedAt);
  const isCooledDown = live && (isError || !isOnline);

  if (isFetching) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full bg-primary-tint px-2 text-[12px] font-medium text-primary tabular-nums"
        title={fetchingTitle}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
        <span>Atualizando…</span>
      </div>
    );
  }

  if (isCooledDown) {
    return (
      <button
        type="button"
        onClick={onRefresh}
        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-warning-tint px-2 text-[12px] font-medium text-warning tabular-nums transition-colors hover:brightness-95 lg:min-h-[22px]"
        title={
          time
            ? `Conexão oscilando. Dados de ${time} preservados na tela. Toque para tentar agora.`
            : "Aguardando sinal de rede. Toque para tentar."
        }
      >
        <span className="h-1.5 w-1.5 rounded-full bg-warning" aria-hidden="true" />
        <span>{time ? `Pausado · dados de ${time}` : "Aguardando rede"}</span>
      </button>
    );
  }

  if (live) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full bg-success-tint px-2 text-[12px] font-medium text-success tabular-nums"
        title="Ao vivo · atualiza automaticamente enquanto a tela estiver visível"
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75 motion-reduce:hidden" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
        </span>
        <span>{time ? `Ao vivo · ${time}` : "Ao vivo"}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onRefresh}
      className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-border bg-subtle px-2 text-[12px] font-medium text-fg-muted tabular-nums transition-colors hover:text-fg lg:min-h-[22px]"
      title="Atualização manual. Toque para buscar agora."
    >
      <span className="h-1.5 w-1.5 rounded-full bg-fg-muted" aria-hidden="true" />
      <span>{time ? `Atualizado às ${time}` : "Manual"}</span>
    </button>
  );
}

type DashboardControlsProps = {
  status: ControlsStatus;
  allAccountsLabel?: string;
  accountValue?: string;
  rangeValue?: string;
  customRangeLabel?: string | null;
  onScopeChange?: (change: ScopeChange) => void;
};

export function DashboardControls({
  status,
  allAccountsLabel,
  accountValue,
  rangeValue,
  customRangeLabel,
  onScopeChange,
}: DashboardControlsProps) {
  const { accounts, clients, clientAccounts, isLoading: accountsLoading } = useMetaAccounts();
  const clientId = useDashboardFilters((s) => s.clientId);
  const platform = useDashboardFilters((s) => s.platform);
  const accountId = useDashboardFilters((s) => s.accountId);
  const range = useDashboardFilters((s) => s.range);
  const liveInterval = useDashboardFilters((s) => s.liveInterval);
  const hideValues = useDashboardFilters((s) => s.hideValues);
  const setOperationalScope = useDashboardFilters((s) => s.setOperationalScope);
  const setRange = useDashboardFilters((s) => s.setRange);
  const setLiveInterval = useDashboardFilters((s) => s.setLiveInterval);
  const toggleHideValues = useDashboardFilters((s) => s.toggleHideValues);
  const isOnline = useOnlineStatus();
  const offersAll = Boolean(allAccountsLabel);
  const shownRange = rangeValue ?? range;

  function firstAccountOf(nextClientId: string, nextPlatform: AdsPlatform) {
    return accounts.find(
      (account) => account.clientId === nextClientId && account.platform === nextPlatform && account.isActive,
    );
  }

  function chooseClient(nextClientId: string) {
    const next = firstAccountOf(nextClientId, platform);
    setOperationalScope({ clientId: nextClientId, platform, accountId: next?.id ?? "" });
    onScopeChange?.({ clientId: nextClientId, accountId: offersAll ? ALL_ACCOUNTS : (next?.id ?? ""), range: shownRange });
  }

  function choosePlatform(nextPlatform: AdsPlatform) {
    const next = firstAccountOf(clientId, nextPlatform);
    setOperationalScope({ clientId, platform: nextPlatform, accountId: next?.id ?? "" });
  }

  function chooseAccount(nextAccountId: string) {
    if (nextAccountId !== ALL_ACCOUNTS) setOperationalScope({ clientId, platform, accountId: nextAccountId });
    onScopeChange?.({ clientId, accountId: nextAccountId, range: shownRange });
  }

  function chooseRange(nextRange: RangeValue) {
    setRange(nextRange);
    onScopeChange?.({ clientId, accountId: accountValue ?? accountId, range: nextRange });
  }

  const live = liveInterval > 0;
  const accountItems = clientAccounts.map((account) => ({
    id: account.id,
    label: account.name,
    description: account.id,
  }));

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <AccountCombobox
        label="Cliente"
        value={clientId}
        onValueChange={chooseClient}
        items={clients.map((client) => ({
          id: client.id,
          label: client.name,
          description: `${accounts.filter((account) => clientOf(account) === client.id).length} conta(s)`,
        }))}
        placeholder={accountsLoading ? "Carregando…" : "Selecione o cliente"}
        searchPlaceholder="Buscar cliente…"
        emptyText="Nenhum cliente com conta autorizada."
        disabled={accountsLoading || clients.length === 0}
        className="w-[min(12rem,44vw)]"
      />

      <select
        value={platform}
        onChange={(event) => choosePlatform(event.target.value as AdsPlatform)}
        aria-label="Plataforma de anúncios"
        className={`${selectClass} min-w-[104px]`}
      >
        <option value="meta">Meta Ads</option>
      </select>

      <AccountCombobox
        label="Conta de anúncios"
        value={accountValue ?? accountId}
        onValueChange={chooseAccount}
        items={offersAll ? [{ id: ALL_ACCOUNTS, label: allAccountsLabel ?? "" }, ...accountItems] : accountItems}
        placeholder={accountsLoading ? "Carregando contas…" : "Selecione a conta"}
        searchPlaceholder="Buscar conta por nome ou ID…"
        emptyText="Este cliente não possui conta autorizada."
        disabled={accountsLoading || !clientId || clientAccounts.length === 0}
        className="w-[min(14rem,50vw)]"
      />

      <select
        value={shownRange}
        onChange={(e) => chooseRange(e.target.value as RangeValue)}
        aria-label="Período"
        className={selectClass}
      >
        {RANGE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
        {customRangeLabel && <option value={shownRange}>{customRangeLabel}</option>}
      </select>

      <label className="relative flex shrink-0 items-center">
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute left-2.5 h-1.5 w-1.5 rounded-full ${
            live ? "bg-success" : "bg-fg-muted"
          }`}
        />
        <span className="sr-only">Frequência de atualização</span>
        <select
          value={liveInterval}
          onChange={(e) => setLiveInterval(Number(e.target.value) as LiveInterval)}
          className={`${selectClass} pl-6`}
        >
          {LIVE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <LiveBadge
        live={live}
        isError={status.isError}
        isFetching={status.isFetching}
        updatedAt={status.updatedAt}
        isOnline={isOnline}
        fetchingTitle={status.fetchingTitle}
        onRefresh={status.refresh}
      />

      <button
        type="button"
        onClick={status.refresh}
        disabled={!status.canRefresh || status.isFetching}
        aria-label={status.refreshLabel}
        title="Atualizar agora"
        className={iconButtonClass}
      >
        <RefreshCw size={15} className={status.isFetching ? "animate-spin text-primary" : ""} />
      </button>

      <button
        type="button"
        onClick={toggleHideValues}
        aria-pressed={hideValues}
        aria-label={hideValues ? "Mostrar valores" : "Ocultar valores"}
        title={hideValues ? "Mostrar valores" : "Ocultar valores"}
        className={iconButtonClass}
      >
        {hideValues ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

export function MetaDashboardControls() {
  const dados = useMetaDados();
  return (
    <DashboardControls
      status={{
        isFetching: dados.isFetching,
        isError: dados.isError,
        updatedAt: dados.dataUpdatedAt,
        canRefresh: dados.hasAccount,
        refresh: () => void dados.refresh(),
        fetchingTitle: "Buscando dados frescos com a Meta…",
        refreshLabel: "Atualizar dados da Meta agora",
      }}
    />
  );
}
