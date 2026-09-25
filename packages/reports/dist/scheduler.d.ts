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
export declare function getPendingReports(prisma: SchedulerPrismaClient): Promise<ScheduledReport[]>;
/**
 * Atualiza o next_run_at após executar um relatório
 */
export declare function rescheduleReport(prisma: SchedulerPrismaClient, reportId: string, frequency: ScheduledReport['frequency']): Promise<void>;
/**
 * Calcula a próxima data de execução a partir de agora
 */
export declare function calculateNextRun(frequency: ScheduledReport['frequency']): string;
