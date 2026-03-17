"use client";

import React, { useState } from "react";
import { useAppStore } from "@/store/data-store";
import { statusLabel } from "@/lib/utils";
import { ChevronDown, X, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

interface DashboardFiltersProps {
  filterOptions: {
    accounts: Array<{ id: string; name: string }>;
    statuses: string[];
    objectives?: string[];
  };
}

function MultiSelectDropdown({
  label,
  options,
  selected,
  onChange,
  placeholder,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOption = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const clearAll = () => {
    onChange([]);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="glass rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-cyan-400/30 transition-all hover:bg-white/5 min-w-40 text-left flex items-center justify-between border-white/10"
      >
        <span className="truncate">
          {selected.length > 0 ? `${selected.length} selecionados` : placeholder}
        </span>
        <ChevronDown size={14} className={cn("transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute z-20 mt-1 bg-slate-900 border border-white/10 rounded-xl shadow-xl min-w-48 max-h-64 overflow-auto">
            <div className="p-2 space-y-1">
              {options.map((option) => (
                <label
                  key={option}
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-white/5 rounded-lg cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(option)}
                    onChange={() => toggleOption(option)}
                    className="rounded border-white/20 bg-white/5 text-cyan-400 focus:ring-1 focus:ring-cyan-400/30"
                  />
                  <span className="text-sm text-slate-300">{label === "Status" ? statusLabel(option) : option}</span>
                </label>
              ))}
            </div>
            {selected.length > 0 && (
              <div className="border-t border-white/10 p-2">
                <button
                  type="button"
                  onClick={clearAll}
                  className="w-full text-xs text-slate-400 hover:text-slate-300 transition-colors"
                >
                  Limpar seleção
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function DashboardFilters({ filterOptions }: DashboardFiltersProps) {
  const { filters, setFilters, getActiveFiltersCount } = useAppStore();
  const activeFiltersCount = getActiveFiltersCount();

  const clearFilters = () => {
    setFilters({
      adAccountId: "all",
      campaignStatuses: [],
      campaignObjectives: [],
    });
  };

  return (
    <div className="space-y-3">
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

        <div className="flex flex-col gap-1.5">
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Status</span>
          <MultiSelectDropdown
            label="Status"
            options={filterOptions.statuses}
            selected={filters.campaignStatuses}
            onChange={(values) => setFilters({ campaignStatuses: values })}
            placeholder="Todos os status"
          />
        </div>

        {filterOptions.objectives && filterOptions.objectives.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">Objetivo</span>
            <MultiSelectDropdown
              label="Objetivo"
              options={filterOptions.objectives}
              selected={filters.campaignObjectives}
              onChange={(values) => setFilters({ campaignObjectives: values })}
              placeholder="Todos os objetivos"
            />
          </div>
        )}

        {activeFiltersCount > 0 && (
          <button
            type="button"
            onClick={clearFilters}
            className="flex flex-col gap-1.5 group"
          >
            <span className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 invisible">Ações</span>
            <div className="glass rounded-xl px-3 py-2.5 text-sm text-slate-300 hover:text-red-400 focus:outline-none focus:ring-1 focus:ring-cyan-400/30 transition-all hover:bg-white/5 border-white/10 flex items-center gap-2">
              <X size={14} className="group-hover:rotate-90 transition-transform" />
              Limpar filtros
            </div>
          </button>
        )}
      </div>

      {activeFiltersCount > 0 && (
        <div className="flex items-center gap-2 text-xs">
          <Filter size={12} className="text-cyan-400" />
          <span className="text-slate-400">
            {activeFiltersCount} filtro{activeFiltersCount !== 1 ? 's' : ''} ativo{activeFiltersCount !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}
