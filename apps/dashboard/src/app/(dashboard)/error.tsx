"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[DashboardError Boundary]", error);
  }, [error]);

  return (
    <div className="flex-1 p-6 lg:p-12 min-w-0 flex items-center justify-center min-h-[70vh]">
      <div className="glass glass-2 rounded-[2.5rem] p-8 lg:p-12 max-w-xl w-full border border-danger/25 text-center relative overflow-hidden noise-overlay shadow-2xl">
        <div className="absolute top-0 right-0 w-48 h-48 bg-danger-tint blur-[90px] rounded-full pointer-events-none" />

        <div className="relative mb-6 flex justify-center">
          <div className="glass w-20 h-20 rounded-3xl flex items-center justify-center border-danger/30 text-danger">
            <AlertTriangle size={36} />
          </div>
        </div>

        <h2 className="text-2xl font-black text-fg uppercase tracking-tight mb-2 relative z-10">
          Falha na Telemetria
        </h2>

        <p className="text-sm text-fg mb-6 leading-relaxed relative z-10">
          {error.message || "Ocorreu um erro inesperado ao carregar os dados operacionais do painel."}
        </p>

        {error.digest && (
          <p className="text-[12px] font-mono text-fg-muted uppercase tracking-widest mb-6 relative z-10">
            Digest: {error.digest}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-center gap-3 relative z-10">
          <Button
            onClick={reset}
            variant="default"
            size="default"
            className="gap-2"
          >
            <RotateCcw size={16} />
            Tentar novamente
          </Button>

          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all duration-200 cursor-pointer select-none border border-border bg-transparent text-fg hover:bg-subtle hover:text-fg active:scale-[0.98] h-10 px-4 py-2"
          >
            <Home size={16} />
            Início
          </Link>
        </div>
      </div>
    </div>
  );
}
