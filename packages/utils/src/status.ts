/**
 * Mapeamento de status para exibição em português
 */

export type CampaignStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
export type AccountStatus = 'active' | 'expired' | 'disconnected';

export interface StatusMapping {
  label: string;
  color: string;
  variant: 'success' | 'warning' | 'error' | 'default';
}

/**
 * Mapeia status de campanha para label e cor
 */
export function getCampaignStatus(status: CampaignStatus): StatusMapping {
  const mappings: Record<CampaignStatus, StatusMapping> = {
    ACTIVE: {
      label: 'Ativa',
      color: 'text-emerald-400',
      variant: 'success',
    },
    PAUSED: {
      label: 'Pausada',
      color: 'text-amber-400',
      variant: 'warning',
    },
    ARCHIVED: {
      label: 'Arquivada',
      color: 'text-slate-400',
      variant: 'default',
    },
  };

  return mappings[status] || {
    label: status,
    color: 'text-slate-400',
    variant: 'default',
  };
}

/**
 * Mapeia status de conta para label e cor
 */
export function getAccountStatus(status: AccountStatus): StatusMapping {
  const mappings: Record<AccountStatus, StatusMapping> = {
    active: {
      label: 'Conectada',
      color: 'text-emerald-400',
      variant: 'success',
    },
    expired: {
      label: 'Token Expirado',
      color: 'text-red-400',
      variant: 'error',
    },
    disconnected: {
      label: 'Desconectada',
      color: 'text-slate-400',
      variant: 'default',
    },
  };

  return mappings[status] || {
    label: status,
    color: 'text-slate-400',
    variant: 'default',
  };
}

/**
 * Mapeia código de status do Meta (account_status) para label
 */
export function getMetaAccountStatusCode(code: number): StatusMapping {
  if (code === 1) {
    return {
      label: 'Ativa',
      color: 'text-emerald-400',
      variant: 'success',
    };
  }
  if (code === 3) {
    return {
      label: 'Token Expirado',
      color: 'text-red-400',
      variant: 'error',
    };
  }
  if (code === 101) {
    return {
      label: 'Desconectada',
      color: 'text-slate-400',
      variant: 'default',
    };
  }

  return {
    label: 'Desconhecido',
    color: 'text-slate-400',
    variant: 'default',
  };
}

/**
 * Mapeia código de status para string de status
 */
export function statusToCode(status: string): number {
  if (status === 'active') return 1;
  if (status === 'expired') return 3;
  if (status === 'disconnected') return 101;
  return 0;
}

/**
 * Mapeia código de status para string de status
 */
export function codeToStatus(code: number): AccountStatus {
  if (code === 1) return 'active';
  if (code === 3) return 'expired';
  if (code === 101) return 'disconnected';
  return 'disconnected';
}
