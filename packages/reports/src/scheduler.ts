/**
 * @start-metric/reports
 * Scheduler — calcula próxima execução e filtra relatórios pendentes
 */

import type { ScheduledReport } from '@start-metric/types';

export interface SchedulerPrismaClient {
  scheduled_reports: {
    findMany: (args: any) => Promise<ScheduledReport[]>;
    update: (args: any) => Promise<ScheduledReport>;
  };
}

/**
 * Retorna relatórios agendados que devem ser executados agora
 */
export async function getPendingReports(
  prisma: SchedulerPrismaClient,
): Promise<ScheduledReport[]> {
  const now = new Date().toISOString();

  return prisma.scheduled_reports.findMany({
    where: {
      status: 'active',
      next_run_at: { lte: now },
    },
  });
}

/**
 * Atualiza o next_run_at após executar um relatório
 */
export async function rescheduleReport(
  prisma: SchedulerPrismaClient,
  reportId: string,
  frequency: ScheduledReport['frequency'],
): Promise<void> {
  const nextRun = calculateNextRun(frequency);

  await prisma.scheduled_reports.update({
    where: { id: reportId },
    data: { next_run_at: nextRun },
  });
}

/**
 * Calcula a próxima data de execução a partir de agora
 */
export function calculateNextRun(frequency: ScheduledReport['frequency']): string {
  const next = new Date();

  switch (frequency) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      next.setHours(8, 0, 0, 0); // 08:00 no dia seguinte
      break;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      next.setHours(8, 0, 0, 0);
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + 1);
      next.setDate(1);
      next.setHours(8, 0, 0, 0);
      break;
  }

  return next.toISOString();
}
