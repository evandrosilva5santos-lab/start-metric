import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Utilitário para concatenar classes do Tailwind com merge inteligente.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Converte o status da campanha em uma label human-friendly em português.
 */
export function statusLabel(status: string): string {
  const statusMap: Record<string, string> = {
    ACTIVE: "Ativa",
    PAUSED: "Pausada",
    DELETED: "Excluída",
    ARCHIVED: "Arquivada",
    PENDING_REVIEW: "Em Revisão",
    DISAPPROVED: "Reprovada",
    IN_PROCESS: "Processando",
    WITH_ISSUES: "Com Erros",
  };
  return statusMap[status] || status;
}

/**
 * Formata número em moeda brasileira (BRL).
 */
const MISSING_VALUE = "—";

function isMissing(value: number | null | undefined): value is null | undefined {
  return value === null || value === undefined || !Number.isFinite(value);
}

export function formatCurrency(value: number | null | undefined): string {
  if (isMissing(value)) return MISSING_VALUE;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Formata número com separadores de milhares.
 */
export function formatNumber(value: number | null | undefined): string {
  if (isMissing(value)) return MISSING_VALUE;
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
