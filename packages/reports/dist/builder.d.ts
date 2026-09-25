/**
 * @start-metric/reports
 * Report Builder — gera relatórios a partir de templates e dados agregados
 */
import type { ReportTemplate, ReportExecution, ScheduledReport, AggregatedMetrics, DateRange } from '@start-metric/types';
import { type ReportsPrismaClient } from './aggregator.js';
export interface ReportData {
    execution: ReportExecution;
    template: ReportTemplate;
    metrics: AggregatedMetrics;
    dateRange: DateRange;
    generatedAt: string;
}
export interface ReportBuilderPrismaClient extends ReportsPrismaClient {
    scheduled_reports: {
        findUnique: (args: any) => Promise<ScheduledReport | null>;
        update: (args: any) => Promise<ScheduledReport>;
    };
    report_templates: {
        findUnique: (args: any) => Promise<ReportTemplate | null>;
    };
    report_executions: {
        create: (args: any) => Promise<ReportExecution>;
        update: (args: any) => Promise<ReportExecution>;
    };
}
/**
 * Cria uma execução de relatório e gera os dados
 */
export declare function buildReport(prisma: ReportBuilderPrismaClient, scheduledReport: ScheduledReport): Promise<ReportData>;
/**
 * Formata o relatório como texto para envio (WhatsApp, email, etc.)
 */
export declare function formatReportText(data: ReportData): string;
