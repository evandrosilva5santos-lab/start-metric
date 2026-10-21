"use client";

import { useState, type ReactNode } from "react";
import { Building2, ChevronDown, UserRound } from "lucide-react";
import { groupLabel, groupSummary, type AccountGroup, type DiscoveredAccount } from "@/lib/meta/account-groups";

const AUTO_EXPAND_LIMIT = 3;

type Props = {
  groups: AccountGroup[];
  selected: ReadonlySet<string>;
  onToggle: (externalId: string) => void;
  onSetMany: (externalIds: string[], checked: boolean) => void;
  isLocked?: (account: DiscoveredAccount) => boolean;
  renderBadges?: (account: DiscoveredAccount, checked: boolean) => ReactNode;
  expandAll?: boolean;
  emptyText?: string;
};

function groupKey(group: AccountGroup): string {
  return group.business ? `bm:${group.business.id}` : "personal";
}

function summaryText(group: AccountGroup): string {
  const { total, inPanel } = groupSummary(group);
  const accounts = total === 1 ? "1 conta" : `${total} contas`;
  return inPanel > 0 ? `${accounts} · ${inPanel} no painel` : accounts;
}

export function AccountGroupList({
  groups,
  selected,
  onToggle,
  onSetMany,
  isLocked = () => false,
  renderBadges,
  expandAll = false,
  emptyText = "Nenhuma conta encontrada.",
}: Props) {
  const [opened, setOpened] = useState<Set<string>>(
    () => new Set(groups.length <= AUTO_EXPAND_LIMIT ? groups.map(groupKey) : []),
  );

  if (groups.length === 0) {
    return <p className="rounded-lg border border-border bg-card p-4 text-center text-sm text-muted-foreground">{emptyText}</p>;
  }

  function toggleOpen(key: string) {
    setOpened((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <ul className="space-y-2">
      {groups.map((group) => {
        const key = groupKey(group);
        const isOpen = expandAll || opened.has(key);
        const selectable = group.accounts.filter((account) => !isLocked(account)).map((account) => account.externalId);
        const allSelected = selectable.length > 0 && selectable.every((id) => selected.has(id));
        const label = groupLabel(group);
        const Icon = group.business ? Building2 : UserRound;
        return (
          <li key={key} className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex flex-wrap items-center gap-2 px-2 py-1">
              <button
                type="button"
                onClick={() => toggleOpen(key)}
                aria-expanded={isOpen}
                className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md px-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <ChevronDown
                  size={16}
                  aria-hidden="true"
                  className={`shrink-0 text-muted-foreground transition-transform motion-reduce:transition-none ${isOpen ? "" : "-rotate-90"}`}
                />
                <Icon size={16} aria-hidden="true" className="shrink-0 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground" title={label}>
                    {label}
                  </span>
                  <span className="block text-xs tabular-nums text-muted-foreground">{summaryText(group)}</span>
                </span>
              </button>
              {selectable.length > 0 && (
                <button
                  type="button"
                  onClick={() => onSetMany(selectable, !allSelected)}
                  className="min-h-11 shrink-0 rounded-md px-3 text-xs font-medium text-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {allSelected ? "Desmarcar todas deste gerenciador" : "Selecionar todas deste gerenciador"}
                </button>
              )}
            </div>
            {isOpen && (
              <ul className="divide-y divide-border border-t border-border">
                {group.accounts.map((account) => {
                  const locked = isLocked(account);
                  const checked = locked || selected.has(account.externalId);
                  return (
                    <li key={account.externalId}>
                      <label
                        className={`flex min-h-11 items-center gap-3 px-4 py-2 ${locked ? "cursor-default" : "cursor-pointer hover:bg-muted"}`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={locked}
                          onChange={() => onToggle(account.externalId)}
                          className="h-4 w-4 shrink-0 accent-primary"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-foreground" title={account.name}>
                            {account.name}
                          </span>
                          <span className="block truncate font-mono text-xs tabular-nums text-muted-foreground">
                            {account.externalId} · {account.currency ?? "—"}
                            {account.accountStatus !== null && account.accountStatus !== 1 ? " · inativa na Meta" : ""}
                          </span>
                        </span>
                        {renderBadges?.(account, checked)}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
