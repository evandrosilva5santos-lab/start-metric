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

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

function updatedLabel(updatedAt: number, now: number): string {
  if (!updatedAt) return "carregando…";
  const minutes = Math.floor((now - updatedAt) / 60_000);
  if (minutes < 1) return "atualizado agora";
  if (minutes < 60) return `atualizado há ${minutes} min`;
  return `atualizado às ${new Date(updatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
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
  const now = useNow(15_000);

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
        className={`${selectClass} min-w-0 max-w-[200px] truncate`}
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
        className={`${selectClass} min-w-0 max-w-[240px] truncate`}
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
            live ? "bg-primary animate-pulse motion-reduce:animate-none" : "bg-text-muted"
          }`}
        />
        <span className="sr-only">Modo de atualização</span>
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

      <span
        role="status"
        className="shrink-0 whitespace-nowrap text-xs text-text-muted tabular-nums"
      >
        {dados.isError ? "falha ao atualizar" : updatedLabel(dados.dataUpdatedAt, now)}
      </span>

      <button
        type="button"
        onClick={() => void dados.refresh()}
        disabled={!dados.hasAccount || dados.isFetching}
        aria-label="Atualizar dados da Meta"
        title="Atualizar"
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
