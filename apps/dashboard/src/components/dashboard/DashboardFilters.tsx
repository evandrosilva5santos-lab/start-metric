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
        className="glass rounded-xl px-3 py-2.5 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all hover:bg-subtle min-w-40 text-left flex items-center justify-between border-border"
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
          <div className="absolute z-20 mt-1 bg-surface border border-border rounded-xl shadow-xl min-w-48 max-h-64 overflow-auto">
            <div className="p-2 space-y-1">
              {options.map((option) => (
                <label
                  key={option}
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-subtle rounded-lg cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(option)}
                    onChange={() => toggleOption(option)}
                    className="rounded border-border bg-subtle text-primary focus:ring-1 focus:ring-primary/30"
                  />
                  <span className="text-sm text-fg">{label === "Status" ? statusLabel(option) : option}</span>
                </label>
              ))}
            </div>
            {selected.length > 0 && (
              <div className="border-t border-border p-2">
                <button
                  type="button"
                  onClick={clearAll}
                  className="w-full text-xs text-fg-muted hover:text-fg transition-colors"
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
          <span className="text-[12px] font-black uppercase tracking-[0.2em] text-fg-muted">De</span>
          <input
            type="date"
            value={filters.from}
            onChange={(event) => setFilters({ from: event.target.value })}
            className="glass rounded-xl px-3 py-2.5 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all hover:bg-subtle border-border"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-black uppercase tracking-[0.2em] text-fg-muted">Até</span>
          <input
            type="date"
            value={filters.to}
            onChange={(event) => setFilters({ to: event.target.value })}
            className="glass rounded-xl px-3 py-2.5 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all hover:bg-subtle border-border"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-black uppercase tracking-[0.2em] text-fg-muted">Conta</span>
          <select
            value={filters.adAccountId}
            onChange={(event) => setFilters({ adAccountId: event.target.value })}
            className="glass rounded-xl px-3 py-2.5 text-sm text-fg focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all hover:bg-subtle cursor-pointer min-w-40 border-border"
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
          <span className="text-[12px] font-black uppercase tracking-[0.2em] text-fg-muted">Status</span>
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
            <span className="text-[12px] font-black uppercase tracking-[0.2em] text-fg-muted">Objetivo</span>
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
            <span className="text-[12px] font-black uppercase tracking-[0.2em] text-fg-muted invisible">Ações</span>
            <div className="glass rounded-xl px-3 py-2.5 text-sm text-fg hover:text-danger focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all hover:bg-subtle border-border flex items-center gap-2">
              <X size={14} className="group-hover:rotate-90 transition-transform" />
              Limpar filtros
            </div>
          </button>
        )}
      </div>

      {activeFiltersCount > 0 && (
        <div className="flex items-center gap-2 text-xs">
          <Filter size={12} className="text-primary" />
          <span className="text-fg-muted">
            {activeFiltersCount} filtro{activeFiltersCount !== 1 ? 's' : ''} ativo{activeFiltersCount !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </div>
  );
}
