"use client";

import { SEVERITY_FILTER_OPTIONS, STATE_FILTER_OPTIONS } from "@/lib/alerts/present";
import type { TriageQuery } from "@/lib/alerts/schemas";
import type { AlertAssignee } from "@/lib/alerts/types";

export const FIELD_CLASS =
  "h-11 w-full rounded-control border border-border-strong bg-surface px-2.5 text-[13px] text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-8";

type Option = { value: string; label: string };

type FilterSelectProps = {
  id: string;
  label: string;
  value: string;
  options: readonly Option[];
  onChange: (value: string) => void;
};

function FilterSelect({ id, label, value, options, onChange }: FilterSelectProps) {
  return (
    <div className="flex min-w-[150px] flex-1 flex-col gap-1 sm:max-w-[220px]">
      <label htmlFor={id} className="text-[12px] font-medium text-fg-muted">
        {label}
      </label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={FIELD_CLASS}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function assigneeOptions(assignees: readonly AlertAssignee[], meId: string | null): Option[] {
  return assignees
    .filter((person) => person.id !== meId)
    .map((person) => ({ value: person.id, label: person.name?.trim() || "Pessoa sem nome" }));
}

type TriageFiltersProps = {
  query: TriageQuery;
  assignees: readonly AlertAssignee[];
  meId: string | null;
  onChange: (next: Partial<TriageQuery>) => void;
};

export function TriageFilters({ query, assignees, meId, onChange }: TriageFiltersProps) {
  const people = assigneeOptions(assignees, meId);
  const known = new Set(["all", "me", "unassigned", ...people.map((person) => person.value)]);
  const recipientOptions: Option[] = [
    { value: "all", label: "Todos" },
    { value: "me", label: "Eu" },
    { value: "unassigned", label: "Sem destinatário" },
    ...people,
    ...(known.has(query.assigned_to) ? [] : [{ value: query.assigned_to, label: "Pessoa selecionada" }]),
  ];

  return (
    <div role="group" aria-label="Filtros da triagem" className="flex flex-wrap items-end gap-3">
      <FilterSelect
        id="filtro-estado"
        label="Estado"
        value={query.state}
        options={STATE_FILTER_OPTIONS}
        onChange={(value) => onChange({ state: value as TriageQuery["state"] })}
      />
      <FilterSelect
        id="filtro-severidade"
        label="Severidade"
        value={query.severity}
        options={SEVERITY_FILTER_OPTIONS}
        onChange={(value) => onChange({ severity: value as TriageQuery["severity"] })}
      />
      <FilterSelect
        id="filtro-destinatario"
        label="Destinatário"
        value={query.assigned_to}
        options={recipientOptions}
        onChange={(value) => onChange({ assigned_to: value })}
      />
    </div>
  );
}
