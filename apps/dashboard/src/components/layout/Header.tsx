"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut, Menu, Settings, User, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useSessionIdentity, type SessionIdentity } from "@/hooks/useSessionIdentity";
import { useDiagnosticCount } from "@/hooks/useMetaDashboard";
import { clearSnapshots } from "@/lib/dashboard/snapshot";
import { useDashboardFilters } from "@/store/dashboard-filters";
import { DashboardControls } from "@/components/layout/DashboardControls";
import { BrandMark, NavLinks } from "@/components/layout/Sidebar";
import { DISCOVER_NAV, MANAGE_NAV, META_NAV, isMetaPath } from "@/components/layout/nav-items";

function getInitials(name: string, email: string) {
  if (name) {
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }
  return email?.[0]?.toUpperCase() ?? "EV";
}

const menuItemClass =
  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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
  const showControls = isMetaPath(pathname);

  useEffect(() => {
    void useDashboardFilters.persist.rehydrate();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {}
    document.cookie = "painel_session=; path=/; max-age=0";
    // Os números guardados para abrir rápido não ficam no navegador após sair.
    clearSnapshots();
    router.push("/auth");
  }

  const initials = getInitials(userName ?? "Evandro", userEmail ?? "");

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-popover">
      <div className="flex min-h-16 items-center gap-3 px-4 py-3 lg:px-8">
        <div className="lg:hidden">
          <BrandMark compact />
        </div>

        <div className="hidden min-w-0 flex-1 lg:block">{showControls && <DashboardControls />}</div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <div className="relative hidden sm:block" ref={userMenuRef}>
            <button
              type="button"
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              aria-haspopup="true"
              aria-expanded={isUserMenuOpen}
              className="flex items-center gap-2 rounded-lg border border-border bg-input py-1 pl-1 pr-2.5 transition-colors hover:border-white-hairline-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-dim text-xs font-bold text-primary">
                {initials}
              </span>
              <span className="max-w-[140px] truncate text-sm font-medium text-text-primary">
                {userName ?? userEmail ?? "Evandro"}
              </span>
              <ChevronDown
                size={14}
                className={`text-text-muted transition-transform ${isUserMenuOpen ? "rotate-180" : ""}`}
              />
            </button>

            {isUserMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-56 overflow-hidden rounded-lg border border-border bg-popover p-1.5">
                <Link href="/settings/profile" prefetch={true} onClick={() => setIsUserMenuOpen(false)} className={menuItemClass}>
                  <User size={16} className="text-text-muted" />
                  Meu perfil
                </Link>
                <Link href="/settings" prefetch={true} onClick={() => setIsUserMenuOpen(false)} className={menuItemClass}>
                  <Settings size={16} className="text-text-muted" />
                  Configurações
                </Link>
                <div className="my-1 h-px bg-border" />
                <button
                  type="button"
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    void handleSignOut();
                  }}
                  disabled={isSigningOut}
                  className={`${menuItemClass} text-danger disabled:opacity-50`}
                >
                  <LogOut size={16} />
                  Sair
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label={isMobileMenuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-nav"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-input text-text-primary lg:hidden"
          >
            {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {showControls && (
        <div className="border-t border-border px-4 py-2.5 lg:hidden">
          <DashboardControls />
        </div>
      )}

      {isMobileMenuOpen && (
        <nav id="mobile-nav" aria-label="Menu principal" className="space-y-5 border-t border-border px-3 py-4 lg:hidden">
          <NavLinks
            items={META_NAV}
            pathname={pathname}
            diagnosticCount={diagnosticCount}
            onNavigate={() => setIsMobileMenuOpen(false)}
          />
          <NavLinks
            items={DISCOVER_NAV}
            pathname={pathname}
            diagnosticCount={diagnosticCount}
            onNavigate={() => setIsMobileMenuOpen(false)}
          />
          <NavLinks
            items={MANAGE_NAV}
            pathname={pathname}
            diagnosticCount={diagnosticCount}
            onNavigate={() => setIsMobileMenuOpen(false)}
          />
          <div className="space-y-1 border-t border-border pt-4">
            <Link href="/settings/profile" onClick={() => setIsMobileMenuOpen(false)} className={menuItemClass}>
              <User size={16} className="text-text-muted" />
              <span className="min-w-0 truncate">{userName || userEmail || "Meu perfil"}</span>
            </Link>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={isSigningOut}
              className={`${menuItemClass} text-danger disabled:opacity-50`}
            >
              <LogOut size={16} />
              Sair
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}
