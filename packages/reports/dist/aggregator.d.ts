/**
 * @start-metric/reports
 * Data Aggregation Engine — consolida métricas de campanhas por período
 */
import type { AggregatedMetrics, DateRange } from '@start-metric/types';
/**
 * PrismaClient com tabelas de métricas
 */
export type ReportsPrismaClient = {
    daily_metrics: {
        findMany: (args: any) => Promise<any[]>;
    };
    campaigns: {
        findMany: (args: any) => Promise<any[]>;
    };
    attributions: {
        findMany: (args: any) => Promise<any[]>;
    };
};
/**
 * Agrega métricas de campanhas no período especificado
 */
export declare function aggregateMetrics(prisma: ReportsPrismaClient, orgId: string, dateRange: DateRange): Promise<AggregatedMetrics>;
