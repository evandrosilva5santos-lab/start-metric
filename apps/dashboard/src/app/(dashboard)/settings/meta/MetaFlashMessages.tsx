"use client";

import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import type { Feedback } from "./types";

type Props = {
  flashConnected: boolean;
  errorMessage: string | null;
  feedback: Feedback | null;
  onDismiss: () => void;
};

export function MetaFlashMessages({ flashConnected, errorMessage, feedback, onDismiss }: Props) {
  return (
    <AnimatePresence mode="wait">
      {flashConnected && (
        <motion.div
          key="connected"
          role="status"
          initial={{ opacity: 0, y: -20, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -20, height: 0 }}
          className="flex items-center gap-3 overflow-hidden rounded-2xl border border-success/20 bg-success-tint p-4 text-sm text-success"
        >
          <CheckCircle2 size={18} className="shrink-0" aria-hidden="true" />
          <span className="font-semibold">Meta conectada.</span>
          <span>Agora escolha quais contas aparecem no painel.</span>
        </motion.div>
      )}

      {errorMessage && (
        <motion.div
          key="error"
          role="alert"
          initial={{ opacity: 0, y: -20, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -20, height: 0 }}
          className="flex items-center gap-3 overflow-hidden rounded-2xl border border-danger/20 bg-danger-tint p-4 text-sm text-danger"
        >
          <AlertCircle size={18} className="shrink-0" aria-hidden="true" />
          <span className="font-semibold">Erro de conexão:</span>
          <span>{errorMessage}</span>
        </motion.div>
      )}

      {feedback && (
        <motion.div
          key="feedback"
          role={feedback.type === "error" ? "alert" : "status"}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`flex items-center gap-3 rounded-2xl p-4 text-sm ${
            feedback.type === "success"
              ? "border border-success/20 bg-success-tint text-success"
              : "border border-danger/20 bg-danger-tint text-danger"
          }`}
        >
          {feedback.type === "success" ? <Info size={18} aria-hidden="true" /> : <AlertCircle size={18} aria-hidden="true" />}
          <span className="font-semibold">{feedback.message}</span>
          <button
            type="button"
            onClick={onDismiss}
            className="ml-auto min-h-11 shrink-0 rounded-md px-2 text-xs font-medium opacity-70 transition-opacity hover:opacity-100"
          >
            Fechar
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
