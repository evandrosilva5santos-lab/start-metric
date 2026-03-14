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
