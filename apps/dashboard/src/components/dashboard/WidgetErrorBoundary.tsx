"use client";

import React, { Component, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  title?: string;
  children: ReactNode;
  className?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class WidgetErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[WidgetErrorBoundary] Erro capturado no widget "${this.props.title ?? 'Sem título'}":`, error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className={cn(
            "glass glass-2 rounded-3xl p-6 lg:p-8 border border-red-500/20 bg-red-500/5 relative overflow-hidden flex flex-col items-center justify-center text-center min-h-[200px] noise-overlay",
            this.props.className
          )}
        >
          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 mb-3 shadow-[0_0_15px_rgba(248,113,113,0.2)]">
            <AlertTriangle size={24} />
          </div>
          <h4 className="text-sm font-black text-white uppercase tracking-wider mb-1">
            {this.props.title ? `Falha ao carregar ${this.props.title}` : "Erro ao carregar componente"}
          </h4>
          <p className="text-xs text-slate-400 max-w-md mb-4">
            {this.state.error?.message || "Ocorreu um erro inesperado ao processar os dados deste widget."}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={this.handleReset}
            className="gap-2 border-red-500/30 text-red-300 hover:bg-red-500/10 hover:text-white"
          >
            <RefreshCw size={14} />
            Tentar novamente
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
