"use client";

import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "./button";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
  className?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class WidgetErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[WidgetErrorBoundary caught an error]:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  public override render() {
    if (this.state.hasError) {
      return (
        <div
          className={`glass rounded-2xl p-6 border border-danger/20 text-center flex flex-col items-center justify-center min-h-[220px] relative overflow-hidden ${
            this.props.className ?? ""
          }`}
          role="alert"
          aria-live="assertive"
        >
          <div className="w-12 h-12 rounded-2xl bg-danger-tint border border-danger/20 flex items-center justify-center text-danger mb-3">
            <AlertTriangle size={22} />
          </div>
          <h4 className="text-sm font-bold text-fg uppercase tracking-wider mb-1">
            {this.props.fallbackTitle ?? "Falha ao carregar widget"}
          </h4>
          <p className="text-xs text-fg-muted max-w-sm mb-4 leading-relaxed">
            {this.state.error?.message ||
              this.props.fallbackMessage ||
              "Ocorreu um erro inesperado ao renderizar este bloco de dados."}
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={this.handleReset}
            className="gap-2 text-xs"
          >
            <RefreshCw size={12} />
            Recarregar componente
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
