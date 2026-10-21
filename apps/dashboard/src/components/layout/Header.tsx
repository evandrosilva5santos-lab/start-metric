"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Bell, LogOut, Menu, Settings, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useSessionIdentity, type SessionIdentity } from "@/hooks/useSessionIdentity";
import { useDiagnosticCount } from "@/hooks/useMetaDashboard";
import { clearSnapshots } from "@/lib/dashboard/snapshot";
import { useDashboardFilters } from "@/store/dashboard-filters";
import { cn } from "@/lib/utils";
import { MetaDashboardControls } from "@/components/layout/DashboardControls";
import { OverviewControls } from "@/components/layout/OverviewControls";
import { initialsOf } from "@/components/layout/Sidebar";
import { BottomBar, NavDrawer } from "@/components/layout/MobileNav";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { isMetaPath, isOverviewPath, pageTitle } from "@/components/layout/nav-items";

const ICON_STROKE = 1.75;

const iconButtonClass =
  "flex size-11 shrink-0 items-center justify-center rounded-button border border-border bg-card text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:size-8";

const menuItemClass =
  "flex h-11 w-full items-center gap-2.5 rounded-control px-2.5 text-[14px] text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-9";

export function Header({ identity }: { identity?: Promise<SessionIdentity> }) {
  const pathname = usePathname();
  const router = useRouter();
  const sessionIdentity = useSessionIdentity(identity);
  const userEmail = sessionIdentity?.email ?? null;
  const userName = sessionIdentity?.name ?? null;
  const diagnosticCount = useDiagnosticCount();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const isOverview = isOverviewPath(pathname);
  const showControls = isOverview || isMetaPath(pathname);
  const title = pageTitle(pathname);
  const initials = initialsOf(userName, userEmail);

  useEffect(() => {
    void useDashboardFilters.persist.rehydrate();
  }, []);

  useEffect(() => {
    if (!isUserMenuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") setIsUserMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isUserMenuOpen]);

  const closeMobileMenu = useCallback(() => setIsMobileMenuOpen(false), []);

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {}
    document.cookie = "painel_session=; path=/; max-age=0";
    clearSnapshots();
    router.push("/auth");
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-card pt-[env(safe-area-inset-top)]">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2 px-2 py-1 md:px-5 md:py-2.5 lg:px-6">
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(true)}
          aria-label="Abrir menu"
          aria-haspopup="dialog"
          aria-expanded={isMobileMenuOpen}
          aria-controls="mobile-nav"
          className="flex size-11 shrink-0 items-center justify-center rounded-button text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
        >
          <Menu size={22} strokeWidth={ICON_STROKE} absoluteStrokeWidth aria-hidden="true" />
        </button>

        <p className="min-w-0 flex-1 truncate text-[16px] font-semibold leading-[1.3] text-foreground md:text-[20px]">{title}</p>

        {showControls && (
          <div className="order-last w-full min-w-0 lg:order-none lg:w-auto">
            {isOverview ? (
              <Suspense fallback={null}>
                <OverviewControls />
              </Suspense>
            ) : (
              <MetaDashboardControls />
            )}
          </div>
        )}

        <div className="flex shrink-0 items-center gap-2.5">
          <Link
            href="/alertas"
            prefetch={true}
            aria-label="Alertas"
            title="Alertas"
            className={cn(iconButtonClass, "max-md:border-transparent")}
          >
            <Bell size={18} strokeWidth={ICON_STROKE} absoluteStrokeWidth aria-hidden="true" />
          </Link>

          <ThemeToggle />

          <div className="relative hidden md:block" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={isUserMenuOpen}
              aria-label={`Conta de ${userName ?? userEmail ?? "usuário"}`}
              className="flex size-11 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:size-8"
            >
              <span className="flex size-8 items-center justify-center rounded-full bg-primary text-[14px] font-medium text-primary-fg">
                {initials}
              </span>
            </button>

            {isUserMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full z-50 mt-2 w-60 rounded-panel border border-border bg-popover p-1 text-popover-foreground shadow-pop"
              >
                <div className="border-b border-border px-2.5 pb-2 pt-1.5">
                  <p className="truncate text-[14px] font-medium text-fg">{userName ?? "Minha conta"}</p>
                  <p className="truncate text-[12px] text-fg-muted">{userEmail ?? "—"}</p>
                </div>
                <div className="pt-1">
                  <Link role="menuitem" href="/settings/profile" prefetch={true} onClick={() => setIsUserMenuOpen(false)} className={menuItemClass}>
                    <User size={16} strokeWidth={ICON_STROKE} absoluteStrokeWidth className="text-fg-muted" aria-hidden="true" />
                    Meu perfil
                  </Link>
                  <Link role="menuitem" href="/settings" prefetch={true} onClick={() => setIsUserMenuOpen(false)} className={menuItemClass}>
                    <Settings size={16} strokeWidth={ICON_STROKE} absoluteStrokeWidth className="text-fg-muted" aria-hidden="true" />
                    Configurações
                  </Link>
                  <button
                    role="menuitem"
                    type="button"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      void handleSignOut();
                    }}
                    disabled={isSigningOut}
                    className={cn(menuItemClass, "text-danger disabled:opacity-50")}
                  >
                    <LogOut size={16} strokeWidth={ICON_STROKE} absoluteStrokeWidth aria-hidden="true" />
                    {isSigningOut ? "Saindo…" : "Sair"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {isMobileMenuOpen && (
        <NavDrawer
          pathname={pathname}
          diagnosticCount={diagnosticCount}
          userLabel={userName || userEmail || "Meu perfil"}
          isSigningOut={isSigningOut}
          onClose={closeMobileMenu}
          onSignOut={() => void handleSignOut()}
        />
      )}

      <BottomBar pathname={pathname} isMenuOpen={isMobileMenuOpen} onOpenMenu={() => setIsMobileMenuOpen(true)} />
    </header>
  );
}
