"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X, CheckCheck } from "lucide-react";
import type { AlertRow } from "@/lib/alerts/types";

type AlertToastProps = {
  alert: AlertRow | null;
  onMarkRead: (id: string) => void;
  onDismiss: () => void;
  autoDismissMs?: number;
};

export function AlertToast({
  alert,
  onMarkRead,
  onDismiss,
  autoDismissMs = 8000,
}: AlertToastProps) {
  useEffect(() => {
    if (!alert) return;
    const timer = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(timer);
  }, [alert, autoDismissMs, onDismiss]);

  function handleMarkRead() {
    if (!alert) return;
    onMarkRead(alert.id);
    onDismiss();
  }

  function handleClose() {
    onDismiss();
  }

  const severityStyles = {
    roas: {
      border: "border-danger/40",
      icon: "text-danger",
      bg: "from-danger-tint to-transparent",
    },
    cpa: {
      border: "border-warning/40",
      icon: "text-warning",
      bg: "from-warning-tint to-transparent",
    },
    spend_no_conversion: {
      border: "border-warning/40",
      icon: "text-warning",
      bg: "from-warning-tint to-transparent",
    },
  };

  const style =
    alert && alert.metric in severityStyles
      ? severityStyles[alert.metric as keyof typeof severityStyles]
      : alert?.severity === "critical"
        ? severityStyles.roas
        : severityStyles.cpa;

  return (
    <AnimatePresence>
      {alert && (
        <motion.div
          key={alert.id}
          initial={{ opacity: 0, x: 80, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 80, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className={`fixed top-5 right-5 z-[60] max-w-sm w-full glass rounded-2xl p-4 ${style.border} bg-gradient-to-br ${style.bg}`}
        >
          {/* Barra de progresso de auto-dismiss */}
          <motion.div
            className="absolute top-0 left-0 h-[2px] rounded-t-2xl bg-gradient-to-r from-primary to-primary"
            initial={{ width: "100%" }}
            animate={{ width: "0%" }}
            transition={{ duration: autoDismissMs / 1000, ease: "linear" }}
          />

          <div className="flex items-start gap-3">
            <div className={`mt-0.5 p-1.5 rounded-lg bg-subtle ${style.icon}`}>
              <AlertTriangle size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-fg leading-tight">
                {alert.title}
              </p>
              <p className="text-xs text-fg mt-1 leading-relaxed line-clamp-2">
                {alert.message}
              </p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={handleMarkRead}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-primary-tint text-primary hover:bg-primary-tint transition-colors font-medium"
                >
                  <CheckCheck size={12} />
                  Marcar lido
                </button>
                <button
                  onClick={handleClose}
                  className="text-xs px-3 py-1.5 rounded-lg bg-subtle text-fg-muted hover:bg-subtle hover:text-fg transition-colors"
                >
                  Fechar
                </button>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-fg-muted hover:text-fg transition-colors p-1"
              aria-label="Fechar alerta"
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
