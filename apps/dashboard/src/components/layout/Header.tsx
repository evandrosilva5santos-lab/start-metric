"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  TrendingUp,
  Wallet,
  Settings,
  LogOut,
  Menu,
  X,
  Zap,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: TrendingUp, label: "Performance", href: "/performance" },
  { icon: Wallet, label: "Contas", href: "/accounts" },
  { icon: Settings, label: "Integrações", href: "/settings" },
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
    <header className="sticky top-0 z-[60] w-full border-b border-cyan-500/10 bg-[#020617]/70 backdrop-blur-2xl noise-overlay">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 h-[72px] flex items-center justify-between gap-6">
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
        <nav className="hidden lg:flex items-center gap-2 flex-1 px-4">
          {NAV_ITEMS.map(({ icon: Icon, label, href }) => {
            const active = isActive(href);
            return (
              <Link
                key={label}
                href={href}
                className={`relative px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.18em] transition-all duration-300 flex items-center gap-2 border ${
                  active
                    ? "text-white bg-white/[0.05] border-cyan-400/25 shadow-[0_10px_30px_rgba(6,182,212,0.16)]"
                    : "text-slate-500 border-white/5 hover:text-slate-200 hover:bg-white/[0.02] hover:border-white/10"
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="header-active"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-[1px] bg-cyan-300 rounded-b-full shadow-[0_0_8px_#22d3ee]"
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
          <div className="glass glass-1 flex items-center gap-2.5 px-3 py-1.5 rounded-full border-white/10">
            <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 flex items-center justify-center border border-white/10 shadow-[0_0_18px_rgba(6,182,212,0.25)]">
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
            className="glass glass-1 p-2 text-slate-500 hover:text-red-400 transition-colors rounded-xl border-white/10 hover:border-red-500/30"
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
            className="lg:hidden border-t border-cyan-500/10 bg-[#020617]/95 backdrop-blur-3xl"
          >
            <div className="px-4 py-4 space-y-2">
              {NAV_ITEMS.map(({ icon: Icon, label, href }) => {
                const active = isActive(href);
                return (
                  <Link
                    key={label}
                    href={href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-[0.15em] transition-all duration-300 border ${
                      active
                        ? "bg-white/[0.05] text-white border-cyan-400/25 shadow-[0_10px_30px_rgba(6,182,212,0.16)]"
                        : "text-slate-500 border-white/5"
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
