"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import {
  LayoutDashboard,
  Settings,
  LogOut,
  Menu,
  X,
  Zap,
  FileText,
  Image as ImageIcon,
  Users,
  User,
  ChevronDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Users, label: "Clientes", href: "/clients" },
  { icon: ImageIcon, label: "Criativos", href: "/criativos" },
  { icon: FileText, label: "Relatórios", href: "/reports" },
  { icon: Settings, label: "Configurações", href: "/settings" },
];

export function Header() {
  const pathname = usePathname();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });

    // Buscar nome do perfil
    const fetchProfile = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", data.user.id)
          .single();
        setUserName(profile?.name ?? null);
      }
    };
    fetchProfile();
  }, []);

  async function handleSignOut() {
    setIsSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  function getInitials(name: string, email: string) {
    if (name) {
      const parts = name.trim().split(" ");
      if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
      return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
    return email?.[0]?.toUpperCase() ?? "U";
  }

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <header className="sticky top-0 z-[50] w-full border-b border-cyan-500/10 bg-[#020617]/70 backdrop-blur-2xl noise-overlay">
      <div className="mx-auto px-4 lg:px-8 h-[72px] flex items-center justify-between gap-6">
        {/* Mobile Logo */}
        <Link href="/" className="lg:hidden relative flex items-center gap-3 group shrink-0">
          <div className="relative">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-indigo-500 flex items-center justify-center text-slate-950 shadow-[0_0_15px_rgba(34,211,238,0.3)]">
              <Zap size={16} fill="currentColor" />
            </div>
          </div>
          <div className="flex flex-col justify-center">
            <span className="font-black text-[10px] tracking-[0.15em] text-white leading-none uppercase">
              START
            </span>
            <span className="font-extrabold text-sm tracking-tighter text-cyan-400 leading-none">
              METRIC
            </span>
          </div>
        </Link>

        {/* Page Title or Search (Optional, keeping empty space for now or for page specific content) */}
        <div className="hidden lg:flex items-center gap-4 flex-1">
          {/* Breadcrumbs or dynamic title could go here */}
        </div>

        {/* User Info & Actions */}
        <div className="flex items-center gap-4 shrink-0 h-full">
          {/* User Dropdown - Desktop */}
          <div className="hidden sm:block relative" ref={userMenuRef}>
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-2xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.05] transition-colors group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 flex items-center justify-center border border-white/10 group-hover:border-cyan-500/30 transition-colors shadow-[0_0_20px_rgba(6,182,212,0.1)]">
                <span className="text-cyan-400 font-bold text-xs uppercase">
                  {getInitials(userName ?? "", userEmail ?? "")}
                </span>
              </div>
              <div className="flex flex-col items-start">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 leading-none mb-1">
                  {userName ? "Bem-vindo" : "Acesso Usuário"}
                </span>
                <span className="text-xs font-bold text-slate-300 max-w-[120px] truncate leading-none">
                  {(userName || userEmail) ?? "Carregando..."}
                </span>
              </div>
              <ChevronDown
                size={14}
                className={`text-slate-500 transition-transform duration-200 ${isUserMenuOpen ? "rotate-180" : ""}`}
              />
            </button>

            {/* Dropdown Menu */}
            <AnimatePresence>
              {isUserMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-56 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
                >
                  <div className="p-2 space-y-1">
                    <Link
                      href="/settings/profile"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                      <User size={16} className="text-slate-500" />
                      Meu Perfil
                    </Link>

                    <Link
                      href="/settings"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                    >
                      <Settings size={16} className="text-slate-500" />
                      Configurações
                    </Link>

                    <div className="h-px bg-slate-700 my-1" />

                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        handleSignOut();
                      }}
                      disabled={isSigningOut}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <LogOut size={16} />
                      Sair
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="h-8 w-px bg-white/5 hidden lg:block" />

          {/* Sign Out Button - Desktop */}
          <button
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="hidden lg:flex group relative items-center justify-center w-10 h-10 rounded-2xl bg-slate-400/5 text-slate-500 hover:text-red-400 hover:bg-red-400/10 transition-all duration-300 border border-white/5 hover:border-red-400/20"
            title="Sair"
          >
            <LogOut size={18} />
          </button>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden w-10 h-10 flex items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-400 hover:bg-cyan-400/20 transition-all duration-300 border border-cyan-400/20"
          >
            {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
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
                {/* Mobile User Info */}
                <Link
                  href="/settings/profile"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 flex items-center justify-center border border-white/10">
                    <span className="text-cyan-400 font-bold text-sm uppercase">
                      {getInitials(userName ?? "", userEmail ?? "")}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-slate-200">
                      {userName || "Usuário"}
                    </span>
                    <span className="text-xs text-slate-500 truncate">
                      {userEmail ?? "Carregando..."}
                    </span>
                  </div>
                </Link>

                {/* Mobile Profile Link */}
                <Link
                  href="/settings/profile"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-slate-300 hover:text-white hover:bg-white/[0.05] transition-colors"
                >
                  <User size={18} />
                  Meu Perfil
                </Link>

                <button
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold uppercase tracking-wider text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
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
