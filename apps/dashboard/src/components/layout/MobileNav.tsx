"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { LogOut, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark, NavLinks } from "@/components/layout/Sidebar";
import { ALL_NAV_ITEMS, BOTTOM_BAR_HREFS, MORE_ICON, activeNavHref } from "@/components/layout/nav-items";

const ICON_STROKE = 1.75;

const BOTTOM_LABELS: Record<string, string> = {
  "/": "Início",
};

const itemClass =
  "flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-button px-1 py-1.5 text-[12px] font-medium leading-[1.2] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function BottomBar({
  pathname,
  isMenuOpen,
  onOpenMenu,
}: {
  pathname: string;
  isMenuOpen: boolean;
  onOpenMenu: () => void;
}) {
  const activeHref = activeNavHref(pathname);
  const shortcuts = BOTTOM_BAR_HREFS.map((href) => ALL_NAV_ITEMS.find((item) => item.href === href)).filter(
    (item): item is NonNullable<typeof item> => Boolean(item),
  );
  const isMoreActive = isMenuOpen || (activeHref !== null && !BOTTOM_BAR_HREFS.includes(activeHref));

  return (
    <nav
      aria-label="Atalhos"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface px-1 pb-[max(4px,env(safe-area-inset-bottom))] pt-1 md:hidden"
    >
      <ul className="flex items-stretch">
        {shortcuts.map((item) => {
          const active = item.href === activeHref;
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex min-w-0 flex-1">
              <Link
                href={item.href}
                prefetch={true}
                aria-current={active ? "page" : undefined}
                className={cn(itemClass, active ? "text-primary" : "text-fg-muted hover:text-fg")}
              >
                <Icon size={22} strokeWidth={ICON_STROKE} absoluteStrokeWidth aria-hidden="true" />
                <span className="truncate">{BOTTOM_LABELS[item.href] ?? item.label}</span>
              </Link>
            </li>
          );
        })}
        <li className="flex min-w-0 flex-1">
          <button
            type="button"
            onClick={onOpenMenu}
            aria-haspopup="dialog"
            aria-expanded={isMenuOpen}
            aria-controls="mobile-nav"
            className={cn(itemClass, isMoreActive ? "text-primary" : "text-fg-muted hover:text-fg")}
          >
            <MORE_ICON size={22} strokeWidth={ICON_STROKE} absoluteStrokeWidth aria-hidden="true" />
            <span>Mais</span>
          </button>
        </li>
      </ul>
    </nav>
  );
}

export function NavDrawer({
  pathname,
  diagnosticCount,
  userLabel,
  isSigningOut,
  onClose,
  onSignOut,
}: {
  pathname: string;
  diagnosticCount: number;
  userLabel: string;
  isSigningOut: boolean;
  onClose: () => void;
  onSignOut: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  const rowClass =
    "flex h-11 w-full items-center gap-2.5 rounded-button px-2 text-[14px] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="fixed inset-0 z-[60] md:hidden" role="dialog" aria-modal="true" aria-label="Menu principal">
      <button
        type="button"
        aria-label="Fechar menu"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-black/50 animate-fade-in"
      />
      <div
        id="mobile-nav"
        className="absolute inset-y-0 left-0 flex w-[min(300px,86vw)] flex-col gap-2 rounded-r-drawer border-r border-sidebar-border bg-sidebar px-2 pb-[max(12px,env(safe-area-inset-bottom))] pt-[max(8px,env(safe-area-inset-top))] text-sidebar-foreground animate-slide-in-left"
      >
        <div className="flex items-center justify-between">
          <BrandMark />
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Fechar menu"
            className="flex size-11 items-center justify-center rounded-button text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X size={22} strokeWidth={ICON_STROKE} absoluteStrokeWidth aria-hidden="true" />
          </button>
        </div>
        <nav aria-label="Menu principal" className="min-h-0 flex-1 overflow-y-auto">
          <NavLinks pathname={pathname} diagnosticCount={diagnosticCount} layout="drawer" onNavigate={onClose} />
        </nav>
        <div className="flex flex-col gap-px border-t border-sidebar-border pt-2">
          <Link href="/settings/profile" onClick={onClose} className={rowClass}>
            <User size={18} strokeWidth={ICON_STROKE} absoluteStrokeWidth aria-hidden="true" />
            <span className="min-w-0 truncate">{userLabel}</span>
          </Link>
          <button type="button" onClick={onSignOut} disabled={isSigningOut} className={cn(rowClass, "disabled:opacity-50")}>
            <LogOut size={18} strokeWidth={ICON_STROKE} absoluteStrokeWidth aria-hidden="true" />
            {isSigningOut ? "Saindo…" : "Sair"}
          </button>
        </div>
      </div>
    </div>
  );
}
