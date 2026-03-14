"use client";

import React from "react";
import { useUIStore } from "@/store/ui-store";
import { Loader2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function GlobalStatusOverlay() {
  const isLoading = useUIStore((state) => state.isLoading);
  const error = useUIStore((state) => state.error);
  const setError = useUIStore((state) => state.setError);

  return (
    <>
      {/* Loading Spinner discreto no topo */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-4 py-2 bg-slate-900/80 backdrop-blur-md border border-cyan-500/30 rounded-full shadow-[0_0_20px_rgba(34,211,238,0.2)]"
          >
            <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
            <span className="text-xs font-medium text-slate-200">Sincronizando dados...</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Alerta de erro global */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed bottom-4 right-4 z-[100] max-w-sm"
          >
            <div className="bg-red-500/10 backdrop-blur-md border border-red-500/50 rounded-xl p-4 flex items-start gap-3 shadow-xl shadow-red-500/5">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-400">Erro de Conexão</p>
                <p className="text-xs text-slate-400 mt-1 line-clamp-2">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="text-[10px] uppercase tracking-wider font-bold text-slate-500 hover:text-red-400 mt-2 transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
