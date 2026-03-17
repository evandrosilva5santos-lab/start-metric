"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Settings,
  Zap,
  Image as ImageIcon,
  Users,
  ChevronRight,
  BarChart3
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/", description: "Visão geral do ROI" },
  { icon: Users, label: "Clientes", href: "/clients", description: "Gestão de contas" },
  { icon: ImageIcon, label: "Criativos", href: "/criativos", description: "Alta performance" },
  { icon: BarChart3, label: "Relatórios", href: "/reports", description: "Análise profunda" },
  { icon: Settings, label: "Configurações", href: "/settings", description: "Preferências" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
  }, []);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <aside 
      className={`fixed left-0 top-0 bottom-0 z-50 transition-all duration-500 ease-in-out border-r border-cyan-500/10 bg-[#020617]/80 backdrop-blur-3xl noise-overlay hidden lg:flex flex-col ${
        isCollapsed ? "w-[80px]" : "w-[280px]"
      }`}
    >
      {/* Logo Section */}
      <div className="h-20 flex items-center px-6 border-b border-white/5">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative flex-shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-400 to-indigo-600 flex items-center justify-center text-slate-950 shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-transform group-hover:scale-110 duration-300">
              <Zap size={18} fill="currentColor" />
            </div>
          </div>
          {!isCollapsed && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex flex-col"
            >
              <span className="font-black text-[10px] tracking-[0.3em] text-white leading-none uppercase">
                START
              </span>
              <span className="font-extrabold text-lg tracking-tighter text-cyan-400 leading-none">
                METRIC
              </span>
            </motion.div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto custom-scrollbar">
        {NAV_ITEMS.map(({ icon: Icon, label, href, description }) => {
          const active = isActive(href);
          return (
            <Link
              key={label}
              href={href}
              className={`group flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-300 relative ${
                active
                  ? "bg-white/[0.05] border border-cyan-400/20 text-white shadow-[0_10px_30px_rgba(6,182,212,0.12)]"
                  : "text-slate-500 hover:text-slate-200 hover:bg-white/[0.02] border border-transparent"
              }`}
            >
              <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                active ? "bg-cyan-400/10 text-cyan-400" : "group-hover:text-cyan-400"
              }`}>
                <Icon size={18} />
              </div>

              {!isCollapsed && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex flex-col min-w-0"
                >
                  <span className="text-[11px] font-black uppercase tracking-[0.1em] truncate">
                    {label}
                  </span>
                  <span className="text-[9px] text-slate-500 font-medium truncate uppercase tracking-wider">
                    {description}
                  </span>
                </motion.div>
              )}

              {active && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute left-0 w-1 h-6 bg-cyan-400 rounded-r-full shadow-[4px_0_12px_rgba(34,211,238,0.8)]"
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Section / Collapse Toggle */}
      <div className="p-4 border-t border-white/5 space-y-4">
        {!isCollapsed && (
          <div className="glass glass-1 p-3 rounded-2xl border-white/5 bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 flex items-center justify-center border border-white/10 shadow-[0_0_18px_rgba(6,182,212,0.15)]">
                <span className="text-cyan-400 font-black text-xs uppercase">
                  {userEmail?.[0] || "U"}
                </span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] font-black text-cyan-500 uppercase tracking-widest leading-none mb-1">
                  CONTA ATIVA
                </span>
                <span className="text-xs font-bold text-slate-300 truncate lowercase">
                  {userEmail ?? "carregando..."}
                </span>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full h-10 flex items-center justify-center rounded-xl bg-white/[0.03] border border-white/5 text-slate-500 hover:text-cyan-400 hover:bg-cyan-400/5 transition-all duration-300"
        >
          <ChevronRight 
            size={18} 
            className={`transition-transform duration-500 ${isCollapsed ? "" : "rotate-180"}`} 
          />
        </button>
      </div>
    </aside>
  );
}
