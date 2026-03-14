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
    <div className="flex flex-wrap items-center gap-3">
      <input
        type="date"
        value={filters.from}
        onChange={(event) => setFilters({ from: event.target.value })}
        className="glass rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-400/30 transition-all hover:bg-white/5"
      />
      <input
        type="date"
        value={filters.to}
        onChange={(event) => setFilters({ to: event.target.value })}
        className="glass rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-400/30 transition-all hover:bg-white/5"
      />
      <select
        value={filters.adAccountId}
        onChange={(event) => setFilters({ adAccountId: event.target.value })}
        className="glass rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-400/30 transition-all hover:bg-white/5 cursor-pointer"
      >
        <option value="all">Todas as contas</option>
        {filterOptions.accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name}
          </option>
        ))}
      </select>
      <select
        value={filters.campaignStatus}
        onChange={(event) => setFilters({ campaignStatus: event.target.value })}
        className="glass rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-400/30 transition-all hover:bg-white/5 cursor-pointer"
      >
        <option value="all">Todos status</option>
        {filterOptions.statuses.map((status) => (
          <option key={status} value={status}>
            {statusLabel(status)}
          </option>
        ))}
      </select>
    </div>
  );
}
