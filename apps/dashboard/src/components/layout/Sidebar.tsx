"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSessionIdentity, type SessionIdentity } from "@/hooks/useSessionIdentity";
import { useDiagnosticCount } from "@/hooks/useMetaDashboard";
import { cn } from "@/lib/utils";
import { DIAGNOSTIC_HREF, NAV_GROUPS, activeNavHref, type NavItem } from "@/components/layout/nav-items";

const ICON_STROKE = 1.75;

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link
      href="/"
      prefetch={true}
      aria-label="Start Metric, ir para a Visão Geral"
      className="flex min-h-8 items-center gap-2 rounded-control px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span aria-hidden="true" className="size-[22px] shrink-0 rounded-control bg-primary" />
      {!compact && (
        <span className="whitespace-nowrap text-[16px] font-semibold leading-[1.2] text-sidebar-foreground">
          Start Metric
        </span>
      )}
    </Link>
  );
}

type NavLinksProps = {
  pathname: string;
  diagnosticCount: number;
  layout: "responsive" | "drawer";
  onNavigate?: () => void;
};

function countFor(item: NavItem, diagnosticCount: number): number | null {
  return item.href === DIAGNOSTIC_HREF && diagnosticCount > 0 ? diagnosticCount : null;
}

export function NavLinks({ pathname, diagnosticCount, layout, onNavigate }: NavLinksProps) {
  const activeHref = activeNavHref(pathname);
  const isDrawer = layout === "drawer";

  return (
    <div className="flex flex-col gap-2">
      {NAV_GROUPS.map((group, index) => (
        <div key={group.label} className="flex flex-col gap-px">
          <p
            className={cn(
              "px-2 pb-1 pt-2 text-[12px] font-medium leading-none text-muted-foreground",
              !isDrawer && "hidden lg:block",
            )}
          >
            {group.label}
          </p>
          {!isDrawer && index > 0 && (
            <span aria-hidden="true" className="mx-3 my-1.5 h-px bg-sidebar-border lg:hidden" />
          )}
          <ul className="flex flex-col gap-px">
            {group.items.map((item) => {
              const active = item.href === activeHref;
              const count = countFor(item, diagnosticCount);
              const Icon = item.icon;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    prefetch={true}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    title={isDrawer ? undefined : item.label}
                    className={cn(
                      "relative flex items-center gap-2.5 rounded-button px-2 text-[14px] leading-[1.55] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      isDrawer ? "h-11" : "h-11 justify-center lg:h-8 lg:justify-start",
                      active
                        ? "bg-accent font-medium text-accent-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
                    )}
                  >
                    <Icon size={18} strokeWidth={ICON_STROKE} absoluteStrokeWidth className="shrink-0" aria-hidden="true" />
                    <span className={cn("truncate", !isDrawer && "sr-only lg:not-sr-only")}>{item.label}</span>
                    {count !== null && (
                      <span
                        className={cn(
                          "rounded-full bg-primary px-1.5 text-[12px] font-medium leading-[18px] text-primary-foreground tabular-nums",
                          isDrawer ? "ml-auto" : "absolute right-1 top-1 lg:static lg:ml-auto",
                        )}
                      >
                        {count}
                        <span className="sr-only"> avisos no diagnóstico</span>
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function initialsOf(name: string | null, email: string | null): string {
  const source = name?.trim() || email?.trim() || "";
  if (!source) return "—";
  const parts = source.split(/[\s@.]+/).filter(Boolean);
  if (name && parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return source[0].toUpperCase();
}

export function Sidebar({ identity }: { identity?: Promise<SessionIdentity> }) {
  const pathname = usePathname();
  const session = useSessionIdentity(identity);
  const userEmail = session?.email ?? null;
  const userName = session?.name ?? null;
  const diagnosticCount = useDiagnosticCount();

  return (
    <aside className="fixed inset-y-0 left-0 z-50 hidden w-[84px] flex-col gap-2 border-r border-sidebar-border bg-sidebar px-2 py-3.5 text-sidebar-foreground md:flex lg:w-[232px]">
      <div className="flex justify-center pb-1.5 pt-0.5 lg:justify-start">
        <span className="lg:hidden">
          <BrandMark compact />
        </span>
        <span className="hidden lg:block">
          <BrandMark />
        </span>
      </div>

      <nav aria-label="Menu principal" className="min-h-0 flex-1 overflow-y-auto">
        <NavLinks pathname={pathname} diagnosticCount={diagnosticCount} layout="responsive" />
      </nav>

      <Link
        href="/settings/profile"
        prefetch={true}
        title={userEmail ?? undefined}
        className="flex min-h-11 items-center justify-center gap-2.5 rounded-button border-t border-sidebar-border px-2 py-2.5 hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:justify-start"
      >
        <span
          aria-hidden="true"
          className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-medium text-accent-foreground"
        >
          {initialsOf(userName, userEmail)}
        </span>
        <span className="hidden min-w-0 flex-col lg:flex">
          <span className="truncate text-[14px] font-medium leading-[1.45] text-sidebar-foreground">
            {userName ?? "Minha conta"}
          </span>
          <span className="truncate text-[12px] leading-[1.4] text-muted-foreground">{userEmail ?? "—"}</span>
        </span>
        <span className="sr-only lg:hidden">Meu perfil</span>
      </Link>
    </aside>
  );
}
