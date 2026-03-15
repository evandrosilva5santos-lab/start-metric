/**
 * Utilitários para formatação e manipulação de datas
 */

/**
 * Formata data para ISO string (YYYY-MM-DD)
 */
export function formatDateISO(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Formata data para exibição em PT-BR
 */
export function formatDateBR(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR');
}

/**
 * Formata data e hora para exibição em PT-BR
 */
export function formatDateTimeBR(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('pt-BR');
}

/**
 * Retorna data de hoje ajustada para timezone do Brasil
 */
export function todayInBrazil(): Date {
  const now = new Date();
  const brazilOffset = -3; // UTC-3
  const localOffset = now.getTimezoneOffset() / -60;
  const diff = brazilOffset - localOffset;
  now.setHours(now.getHours() + diff);
  return now;
}

/**
 * Subtrai dias de uma data
 */
export function subDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

/**
 * Adiciona dias a uma data
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Retorna o range dos últimos N dias
 */
export function lastNDays(n: number): { from: string; to: string } {
  const to = todayInBrazil();
  const from = subDays(to, n - 1);
  return {
    from: formatDateISO(from),
    to: formatDateISO(to),
  };
}

/**
 * Retorna o range do mês atual
 */
export function currentMonth(): { from: string; to: string } {
  const now = todayInBrazil();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return {
    from: formatDateISO(from),
    to: formatDateISO(now),
  };
}

/**
 * Retorna o range do último mês
 */
export function lastMonth(): { from: string; to: string } {
  const now = todayInBrazil();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to = new Date(now.getFullYear(), now.getMonth(), 0);
  return {
    from: formatDateISO(from),
    to: formatDateISO(to),
  };
}

/**
 * Calcula diferença em dias entre duas datas
 */
export function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  const diffMs = Math.abs(date1.getTime() - date2.getTime());
  return Math.round(diffMs / oneDay);
}

/**
 * Formata período de forma relativa
 */
export function formatPeriodRelative(from: string, to: string): string {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const days = daysBetween(fromDate, toDate);

  if (days === 0) return 'Hoje';
  if (days === 1) return 'Últimas 24h';
  if (days === 7) return 'Últimos 7 dias';
  if (days === 30) return 'Últimos 30 dias';
  if (days === 90) return 'Últimos 3 meses';

  return `${formatDateBR(fromDate)} - ${formatDateBR(toDate)}`;
}
