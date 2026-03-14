import React from "react";
import { useAppStore } from "@/store/data-store";
import { statusLabel } from "@/lib/utils";

interface DashboardFiltersProps {
  filterOptions: {
    accounts: Array<{ id: string; name: string }>;
    statuses: string[];
  };
}

export function DashboardFilters({ filterOptions }: DashboardFiltersProps) {
  const { filters, setFilters } = useAppStore();

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">De</span>
        <input
          type="date"
          value={filters.from}
          onChange={(event) => setFilters({ from: event.target.value })}
          className="glass rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-400/30 transition-all hover:bg-white/5 border-white/10"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Até</span>
        <input
          type="date"
          value={filters.to}
          onChange={(event) => setFilters({ to: event.target.value })}
          className="glass rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-400/30 transition-all hover:bg-white/5 border-white/10"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Conta</span>
        <select
          value={filters.adAccountId}
          onChange={(event) => setFilters({ adAccountId: event.target.value })}
          className="glass rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-400/30 transition-all hover:bg-white/5 cursor-pointer min-w-40 border-white/10"
        >
          <option value="all">Todas as contas</option>
          {filterOptions.accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Status</span>
        <select
          value={filters.campaignStatus}
          onChange={(event) => setFilters({ campaignStatus: event.target.value })}
          className="glass rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-400/30 transition-all hover:bg-white/5 cursor-pointer min-w-36 border-white/10"
        >
          <option value="all">Todos status</option>
          {filterOptions.statuses.map((status) => (
            <option key={status} value={status}>
              {statusLabel(status)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
