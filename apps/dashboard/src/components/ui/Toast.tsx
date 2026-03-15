"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type ToastVariant = "success" | "error" | "info" | "warning";

type Toast = {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
};

type ToastContextValue = {
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((variant: ToastVariant) => {
    return (message: string, duration = 4000) => {
      const id = Math.random().toString(36).substring(7);
      const toast: Toast = { id, message, variant, duration };

      setToasts((prev) => [...prev, toast]);

      if (duration > 0) {
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
        }, duration);
      }
    };
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value: ToastContextValue = {
    success: addToast("success"),
    error: addToast("error"),
    info: addToast("info"),
    warning: addToast("warning"),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: Toast[];
  onRemove: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onRemove,
}: {
  toast: Toast;
  onRemove: (id: string) => void;
}) {
  const variants = {
    success: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
    error: "bg-red-500/10 border-red-500/30 text-red-300",
    info: "bg-cyan-500/10 border-cyan-500/30 text-cyan-300",
    warning: "bg-amber-500/10 border-amber-500/30 text-amber-300",
  };

  return (
    <div
      className={cn(
        "glass border p-4 rounded-2xl shadow-2xl flex items-start gap-3 animate-slide-in",
        variants[toast.variant]
      )}
    >
      <span className="text-sm font-medium">{toast.message}</span>
      <button
        onClick={() => onRemove(toast.id)}
        className="text-current/50 hover:text-current transition-colors"
      >
        ✕
      </button>
    </div>
  );
}
