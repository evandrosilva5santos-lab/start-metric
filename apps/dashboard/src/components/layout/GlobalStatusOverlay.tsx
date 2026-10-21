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
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 px-4 py-2 bg-surface backdrop-blur-md border border-primary/30 rounded-full"
          >
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
            <span className="text-xs font-medium text-fg">Sincronizando dados...</span>
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
            <div className="bg-danger-tint backdrop-blur-md border border-danger/40 rounded-xl p-4 flex items-start gap-3 shadow-xl">
              <AlertCircle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-danger">Erro de Conexão</p>
                <p className="text-xs text-fg-muted mt-1 line-clamp-2">{error}</p>
                <button
                  onClick={() => setError(null)}
                  className="text-[12px] uppercase tracking-wider font-bold text-fg-muted hover:text-danger mt-2 transition-colors"
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
