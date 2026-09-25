"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, RefreshCw } from "lucide-react";
import { clientOf, useMetaAccounts, useMetaDados } from "@/hooks/useMetaDashboard";
import {
  LIVE_OPTIONS,
  RANGE_OPTIONS,
  useDashboardFilters,
  type LiveInterval,
  type RangeValue,
} from "@/store/dashboard-filters";

const selectClass =
  "h-9 rounded-lg border border-border bg-input px-3 text-sm font-medium text-text-primary outline-none transition-colors hover:border-white-hairline-strong focus-visible:ring-2 focus-visible:ring-ring cursor-pointer";

const iconButtonClass =
  "h-9 w-9 shrink-0 flex items-center justify-center rounded-lg border border-border bg-input text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

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

function LiveBadge({
  live,
  isError,
  isFetching,
  updatedAt,
  isOnline,
  onRefresh,
}: {
  live: boolean;
  isError: boolean;
  isFetching: boolean;
  updatedAt: number;
  isOnline: boolean;
  onRefresh: () => void;
}) {
  const time = formatExactTime(updatedAt);
  const isCooledDown = live && (isError || !isOnline);

  if (isFetching) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-primary/20 bg-primary-dim/30 px-2.5 py-1 text-xs font-medium text-primary tabular-nums"
        title="Buscando dados frescos com a Meta…"
      >
        <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
        <span>Atualizando…</span>
      </div>
    );
  }

  // Falha de rede ou sem conexão: esfria suavemente mantendo os dados na tela (sem alarme vermelho)
  if (isCooledDown) {
    return (
      <button
        type="button"
        onClick={onRefresh}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border/70 bg-surface-2/60 px-2.5 py-1 text-xs font-medium text-text-secondary tabular-nums transition-colors hover:border-white-hairline-strong hover:text-text-primary"
        title={
          time
            ? `Conexão oscilando. Dados de ${time} preservados na tela. Toque para tentar agora.`
            : "Aguardando sinal de rede. Toque para tentar."
        }
      >
        <span className="h-2 w-2 rounded-full bg-amber-400/80 transition-colors" aria-hidden="true" />
        <span>{time ? `Pausado · dados de ${time}` : "Aguardando rede"}</span>
      </button>
    );
  }

  // Ao vivo ativo e com resposta da Meta
  if (live) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-primary/30 bg-primary-dim/40 px-2.5 py-1 text-xs font-semibold text-primary tabular-nums transition-all"
        title="Ao vivo · atualiza automaticamente enquanto a tela estiver visível"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75 motion-reduce:hidden" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
        <span>{time ? `Ao vivo · ${time}` : "Ao vivo"}</span>
      </div>
    );
  }

  // Atualização manual
  return (
    <button
      type="button"
      onClick={onRefresh}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-input px-2.5 py-1 text-xs font-medium text-text-muted tabular-nums hover:text-text-primary transition-colors"
      title="Atualização manual. Toque para buscar agora."
    >
      <span className="h-2 w-2 rounded-full bg-text-muted" aria-hidden="true" />
      <span>{time ? `Atualizado às ${time}` : "Manual"}</span>
    </button>
  );
}

/** Conta, período, modo ao vivo, atualizar e ocultar valores: valem para todas as telas da Meta. */
export function DashboardControls() {
  const { accounts, clients, clientAccounts, isLoading: accountsLoading } = useMetaAccounts();
  const dados = useMetaDados();
  const clientId = useDashboardFilters((s) => s.clientId);
  const setClientId = useDashboardFilters((s) => s.setClientId);
  const accountId = useDashboardFilters((s) => s.accountId);
  const range = useDashboardFilters((s) => s.range);
  const liveInterval = useDashboardFilters((s) => s.liveInterval);
  const hideValues = useDashboardFilters((s) => s.hideValues);
  const setAccountId = useDashboardFilters((s) => s.setAccountId);
  const setRange = useDashboardFilters((s) => s.setRange);
  const setLiveInterval = useDashboardFilters((s) => s.setLiveInterval);
  const toggleHideValues = useDashboardFilters((s) => s.toggleHideValues);
  const isOnline = useOnlineStatus();

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const selectedClient = clients.find((c) => c.id === clientId);

  function chooseClient(nextClientId: string) {
    setClientId(nextClientId);
    const pool = accounts.filter((a) => clientOf(a) === nextClientId);
    const next = pool.find((a) => a.isActive) ?? pool[0];
    if (next) setAccountId(next.id);
  }
  const live = liveInterval > 0;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <select
        value={clientId}
        onChange={(e) => chooseClient(e.target.value)}
        aria-label="Cliente"
        title={selectedClient?.name}
        disabled={accountsLoading || clients.length === 0}
        className={`${selectClass} min-w-0 max-w-[180px] truncate`}
      >
        {clients.length === 0 && <option value="">{accountsLoading ? "Carregando…" : "Nenhum cliente"}</option>}
        {clients.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name} ({accounts.filter((a) => clientOf(a) === c.id).length})
          </option>
        ))}
      </select>

      <select
        value={accountId}
        onChange={(e) => setAccountId(e.target.value)}
        aria-label="Conta de anúncios"
        title={selectedAccount?.name}
        disabled={accountsLoading || clientAccounts.length === 0}
        className={`${selectClass} min-w-0 max-w-[220px] truncate`}
      >
        {clientAccounts.length === 0 && <option value="">{accountsLoading ? "Carregando contas…" : "Nenhuma conta"}</option>}
        {clientAccounts.map((acc) => (
          <option key={acc.id} value={acc.id}>
            {acc.isActive ? "" : "○ "}
            {acc.name}
          </option>
        ))}
      </select>

      <select
        value={range}
        onChange={(e) => setRange(e.target.value as RangeValue)}
        aria-label="Período"
        className={selectClass}
      >
        {RANGE_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      <label className="relative flex shrink-0 items-center">
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute left-3 h-2 w-2 rounded-full ${
            live ? "bg-primary" : "bg-text-muted"
          }`}
        />
        <span className="sr-only">Frequência de atualização</span>
        <select
          value={liveInterval}
          onChange={(e) => setLiveInterval(Number(e.target.value) as LiveInterval)}
          className={`${selectClass} pl-7`}
        >
          {LIVE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      {/* Selo de "Ao vivo" com hora exata e esfriamento gracioso */}
      <LiveBadge
        live={live}
        isError={dados.isError}
        isFetching={dados.isFetching}
        updatedAt={dados.dataUpdatedAt}
        isOnline={isOnline}
        onRefresh={() => void dados.refresh()}
      />

      <button
        type="button"
        onClick={() => void dados.refresh()}
        disabled={!dados.hasAccount || dados.isFetching}
        aria-label="Atualizar dados da Meta agora"
        title="Atualizar agora"
        className={iconButtonClass}
      >
        <RefreshCw size={15} className={dados.isFetching ? "animate-spin text-primary" : ""} />
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
