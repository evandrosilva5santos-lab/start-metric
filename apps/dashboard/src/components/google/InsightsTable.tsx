"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { Button } from "@/components/ui";
import { VariationBadge } from "@/components/meta/MetaUi";
import { filterRows, sortRows, toCsv, type SortDirection } from "@/lib/google-ads/insights-core";
import type { InsightColumn, RowData } from "./insights-columns";

const PAGE_SIZE = 25;

type Props = {
  rows: RowData[];
  columns: InsightColumn[];
  currency: string;
  defaultSort: { key: string; direction: SortDirection };
  searchFields: string[];
  rowKey: (row: RowData) => string;
  fileName: string;
  emptyMessage: string;
  /** Linhas do período anterior, indexadas por `rowKey`, para mostrar a variação. */
  previous?: ReadonlyMap<string, RowData>;
};

function variation(current: unknown, before: unknown): number | undefined {
  if (typeof current !== "number" || typeof before !== "number" || before === 0) return undefined;
  return ((current - before) / before) * 100;
}

function download(name: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

export function InsightsTable({ rows, columns, currency, defaultSort, searchFields, rowKey, fileName, emptyMessage, previous }: Props) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState(defaultSort);
  const [page, setPage] = useState(0);

  const visible = useMemo(() => sortRows(filterRows(rows, query, searchFields), sort.key, sort.direction), [rows, query, searchFields, sort]);
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const pageRows = visible.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE);

  const toggleSort = (key: string) => {
    setPage(0);
    setSort((s) => (s.key === key ? { key, direction: s.direction === "asc" ? "desc" : "asc" } : { key, direction: "desc" }));
  };

  const exportCsv = () => {
    const data = visible.map((row) => Object.fromEntries(columns.map((c) => [c.key, c.csv ? c.csv(row, currency) : row[c.key]])));
    download(`${fileName}.csv`, toCsv(columns.map((c) => ({ key: c.key, label: c.label })), data));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="relative block w-full max-w-xs">
          <span className="sr-only">Buscar na tabela</span>
          <Search size={15} aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-muted" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
            placeholder="Buscar"
            className="h-11 w-full rounded-lg border border-border bg-input pl-8 pr-3 text-sm text-text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-9"
          />
        </label>
        <div className="flex items-center gap-3">
          <span className="text-xs text-fg-muted" aria-live="polite">
            {visible.length} {visible.length === 1 ? "linha" : "linhas"}
          </span>
          <Button size="sm" variant="outline" onClick={exportCsv} disabled={visible.length === 0}>
            <Download /> Exportar CSV
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-text-secondary">{emptyMessage}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-fg-muted">
                {columns.map((c) => {
                  const active = sort.key === c.key;
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
                      className={`px-3 py-2 font-semibold ${c.numeric ? "text-right" : "text-left"}`}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        className="inline-flex min-h-8 items-center gap-1 uppercase tracking-wider hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {c.label}
                        {active && (sort.direction === "asc" ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />)}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row) => {
                const before = previous?.get(rowKey(row));
                return (
                  <tr key={rowKey(row)} className="border-b border-border last:border-0 align-top">
                    {columns.map((c) => (
                      <td key={c.key} className={`px-3 py-2 ${c.numeric ? "text-right tabular-nums" : "max-w-[260px] truncate text-fg"}`} title={c.numeric ? undefined : c.text(row, currency)}>
                        {c.text(row, currency)}
                        {previous && c.delta && c.numeric && <VariationBadge value={variation(row[c.key], before?.[c.key])} sense={c.delta} />}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className="px-3 py-6 text-center text-sm text-fg-muted">
                    Nada encontrado para essa busca.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 text-xs text-fg-muted">
          <Button size="icon-sm" variant="outline" aria-label="Página anterior" disabled={current === 0} onClick={() => setPage(current - 1)}>
            <ChevronLeft />
          </Button>
          <span>
            Página {current + 1} de {pages}
          </span>
          <Button size="icon-sm" variant="outline" aria-label="Próxima página" disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
            <ChevronRight />
          </Button>
        </div>
      )}
    </div>
  );
}
