"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  TrendingUp,
  Activity,
  Wallet,
  Settings,
  LogOut,
  Menu,
  X,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Overview",       href: "/" },
  { icon: TrendingUp,      label: "Performance",    href: "/performance" },
  { icon: Activity,        label: "Criativos",      href: "/criativos" },
  { icon: Wallet,          label: "Contas",         href: "/accounts" },
  { icon: Settings,        label: "Integrações",    href: "/settings" },
];

export function Header() {
  const pathname = usePathname();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
  }, []);

  async function handleSignOut() {
    setIsSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <header className="sticky top-0 z-[60] w-full border-b border-[#1e293b] bg-[#020617]/80 backdrop-blur-2xl">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Logo */}
        <Link href="/" className="relative flex items-center gap-3 group shrink-0">
          <div className="relative">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-indigo-500 flex items-center justify-center text-slate-950 shadow-[0_0_15px_rgba(34,211,238,0.3)]">
              <Zap size={16} fill="currentColor" />
            </div>
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-cyan-400 rounded-full border-2 border-[#020617] animate-pulse" />
          </div>
          <div className="flex flex-col justify-center">
            <span className="font-black text-[10px] tracking-[0.2em] text-white leading-none uppercase">
              START
            </span>
            <span className="font-extrabold text-sm tracking-tighter text-cyan-400 leading-none">
              METRIC
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-1 flex-1 px-4">
          {NAV_ITEMS.map(({ icon: Icon, label, href }) => {
            const active = isActive(href);
            return (
              <Link
                key={label}
                href={href}
                className={`relative px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-300 flex items-center gap-2 ${
                  active
                    ? "text-white bg-white/[0.03] shadow-lg"
                    : "text-slate-500 hover:text-slate-200 hover:bg-white/[0.02]"
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="header-active"
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-cyan-400 rounded-t-full shadow-[0_0_8px_#22d3ee]"
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <Icon 
                  size={16} 
                  className={active ? "text-cyan-400" : "group-hover:text-cyan-400 transition-colors"} 
                />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User Desktop */}
        <div className="hidden lg:flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white/[0.02] border border-white/5">
            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 flex items-center justify-center border border-white/10">
              <span className="text-cyan-400 font-bold text-[10px] uppercase">
                {userEmail?.[0] || "U"}
              </span>
            </div>
            <span className="text-xs font-semibold text-slate-300 max-w-[120px] truncate">
              {userEmail ?? "Carregando..."}
            </span>
          </div>
          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="p-2 text-slate-500 hover:text-red-400 transition-colors rounded-xl hover:bg-red-500/10"
            title="Sair"
          >
            <LogOut size={18} />
          </button>
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="lg:hidden p-2 -mr-2 text-slate-400 hover:text-white transition-colors"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Nav */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden border-t border-[#1e293b] bg-[#020617]"
          >
            <div className="px-4 py-4 space-y-2">
              {NAV_ITEMS.map(({ icon: Icon, label, href }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={label}
                    href={href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-wider transition-all duration-300 ${
                      active
                        ? "bg-white/[0.04] text-white border border-white/5 shadow-2xl"
                        : "text-slate-500"
                    }`}
                  >
                    <Icon size={18} className={active ? "text-cyan-400" : ""} />
                    {label}
                  </Link>
                );
              })}
              
              <div className="pt-4 mt-4 border-t border-white/5 space-y-4">
                <div className="flex items-center gap-3 px-4">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 flex items-center justify-center border border-white/10">
                    <span className="text-cyan-400 font-bold text-xs uppercase">
                      {userEmail?.[0] || "U"}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-slate-300 truncate">
                    {userEmail ?? "Carregando..."}
                  </span>
                </div>
                
                <button
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-wider text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut size={18} />
                  Sair
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
