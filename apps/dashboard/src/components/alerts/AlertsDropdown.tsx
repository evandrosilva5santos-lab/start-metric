"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, CheckCheck, AlertTriangle, TrendingDown, DollarSign } from "lucide-react";
import type { AlertRow } from "@/lib/alerts/types";

type AlertsDropdownProps = {
  alerts: AlertRow[];
  unreadCount: number;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  isMarkingAllRead: boolean;
};

function metricIcon(metric: string) {
  if (metric === "roas") return <TrendingDown size={13} className="text-red-400" />;
  if (metric === "cpa") return <DollarSign size={13} className="text-amber-400" />;
  return <AlertTriangle size={13} className="text-orange-400" />;
}

function relativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function AlertsDropdown({
  alerts,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  isMarkingAllRead,
}: AlertsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fechar ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="glass rounded-xl px-3 py-2.5 text-sm text-slate-300 hover:text-cyan-300 transition-colors relative"
        aria-label={`Alertas: ${unreadCount} não lidos`}
        id="alerts-bell-button"
      >
        <span className="inline-flex items-center gap-2">
          <Bell size={16} className={unreadCount > 0 ? "animate-pulse-soft" : ""} />
          Alertas
        </span>
        {/* Badge */}
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-2 -right-2 min-w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5 flex items-center justify-center shadow-lg shadow-red-500/30"
              id="alerts-badge-count"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ type: "spring", damping: 25, stiffness: 400 }}
            className="absolute right-0 mt-2 w-[420px] glass-solid rounded-2xl border border-slate-700/50 z-50 overflow-hidden shadow-2xl shadow-black/40"
            id="alerts-dropdown-panel"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/60">
              <h3 className="text-sm font-bold text-white">
                Alertas
                {unreadCount > 0 && (
                  <span className="ml-2 text-xs font-medium text-slate-400">
                    ({unreadCount} não lido{unreadCount !== 1 ? "s" : ""})
                  </span>
                )}
              </h3>
              {unreadCount > 0 && (
                <button
                  onClick={onMarkAllRead}
                  disabled={isMarkingAllRead}
                  className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-colors disabled:opacity-50 font-medium"
                  id="alerts-mark-all-read"
                >
                  <CheckCheck size={12} />
                  {isMarkingAllRead ? "Marcando..." : "Marcar todos"}
                </button>
              )}
            </div>

            {/* Lista */}
            <div className="max-h-[380px] overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="py-12 text-center">
                  <Bell size={24} className="text-slate-700 mx-auto mb-3" />
                  <p className="text-xs text-slate-500">Nenhum alerta no momento</p>
                  <p className="text-[10px] text-slate-600 mt-1">
                    Configure regras para monitorar suas campanhas
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800/40">
                  {alerts.map((alert, index) => (
                    <motion.div
                      key={alert.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="group flex items-start gap-3 px-4 py-3 hover:bg-slate-800/30 transition-colors cursor-default"
                      id={`alert-item-${alert.id}`}
                    >
                      <div className="mt-0.5 p-1.5 rounded-lg bg-slate-800/60 shrink-0">
                        {metricIcon(alert.metric)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-100 leading-tight">
                          {alert.title}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed line-clamp-2">
                          {alert.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] text-slate-600">
                            {relativeTime(alert.triggered_at)}
                          </span>
                          <span className="text-[10px] text-slate-700">•</span>
                          <span className="text-[10px] text-slate-600">
                            Valor: {Number(alert.observed_value).toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => onMarkRead(alert.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-[10px] px-2.5 py-1 rounded-lg bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25 font-medium"
                        aria-label={`Marcar alerta como lido: ${alert.title}`}
                      >
                        Lido
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
