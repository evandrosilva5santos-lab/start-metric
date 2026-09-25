"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap } from "lucide-react";
import { useSessionIdentity, type SessionIdentity } from "@/hooks/useSessionIdentity";
import { useDiagnosticCount } from "@/hooks/useMetaDashboard";
import { META_NAV, DISCOVER_NAV, MANAGE_NAV, isActivePath, type NavItem } from "@/components/layout/nav-items";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" prefetch={true} className="flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary-dim text-primary">
        <Zap size={16} fill="currentColor" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="font-display text-base font-bold tracking-tight text-foreground">Start Metric</span>
        {!compact && (
          <span className="mt-1 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.08em] text-text-muted">
            Anúncios em português
          </span>
        )}
      </span>
    </Link>
  );
}

export function NavLinks({
  items,
  pathname,
  diagnosticCount,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  diagnosticCount: number;
  onNavigate?: () => void;
}) {
  return (
    <ul className="space-y-0.5">
      {items.map(({ icon: Icon, label, href }) => {
        const active = isActivePath(pathname, href);
        const badge = href === "/diagnostico" && diagnosticCount > 0 ? diagnosticCount : null;
        return (
          <li key={href}>
            <Link
              href={href}
              prefetch={true}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active
                  ? "bg-primary-dim font-semibold text-primary"
                  : "font-medium text-text-secondary hover:bg-surface-2 hover:text-text-primary"
              }`}
            >
              <Icon size={17} className="shrink-0" />
              <span className="truncate">{label}</span>
              {badge !== null && (
                <span className="ml-auto rounded-full border border-danger/30 bg-danger-dim px-2 py-0.5 text-[11px] font-bold text-danger tabular-nums">
                  {badge}
                  <span className="sr-only"> avisos</span>
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function Sidebar({ identity }: { identity?: Promise<SessionIdentity> }) {
  const pathname = usePathname();
  const userEmail = useSessionIdentity(identity)?.email ?? null;
  const diagnosticCount = useDiagnosticCount();

  return (
    <aside className="fixed inset-y-0 left-0 z-50 hidden w-[240px] flex-col border-r border-border bg-popover lg:flex">
      <div className="flex h-16 items-center border-b border-border px-5">
        <BrandMark />
      </div>

      <nav aria-label="Menu principal" className="flex-1 space-y-6 overflow-y-auto px-3 py-5">
        <div>
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">Meta Ads</p>
          <NavLinks items={META_NAV} pathname={pathname} diagnosticCount={diagnosticCount} />
        </div>
        <div>
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">Descoberta</p>
          <NavLinks items={DISCOVER_NAV} pathname={pathname} diagnosticCount={diagnosticCount} />
        </div>
        <div>
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">Gestão</p>
          <NavLinks items={MANAGE_NAV} pathname={pathname} diagnosticCount={diagnosticCount} />
        </div>
      </nav>

      <div className="border-t border-border p-4">
        <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary-dim text-xs font-bold uppercase text-primary">
            {userEmail?.[0] ?? "U"}
          </span>
          <span className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">Conta</span>
            <span className="block truncate text-xs font-medium text-text-primary" title={userEmail ?? undefined}>
              {userEmail ?? "carregando…"}
            </span>
          </span>
        </div>
      </div>
    </aside>
  );
}
