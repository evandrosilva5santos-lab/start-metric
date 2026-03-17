/**
 * @start-metric/reports
 * Report Builder — gera relatórios a partir de templates e dados agregados
 */

import type {
  ReportTemplate,
  ReportExecution,
  ScheduledReport,
  AggregatedMetrics,
  DateRange,
} from '@start-metric/types';
import { aggregateMetrics, type ReportsPrismaClient } from './aggregator.js';

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
export async function buildReport(
  prisma: ReportBuilderPrismaClient,
  scheduledReport: ScheduledReport,
): Promise<ReportData> {
  const template = await prisma.report_templates.findUnique({
    where: { id: scheduledReport.template_id },
  });

  if (!template) {
    throw new Error(`Template ${scheduledReport.template_id} not found`);
  }

  // Calcular date range baseado na frequência
  const dateRange = resolveDateRange(scheduledReport.frequency);

  // Criar execução com status "generating"
  const execution = await prisma.report_executions.create({
    data: {
      scheduled_report_id: scheduledReport.id,
      org_id: scheduledReport.org_id,
      status: 'generating',
      generated_at: null,
      sent_at: null,
      error_message: null,
      file_url: null,
      created_at: new Date().toISOString(),
    },
  });

  try {
    const metrics = await aggregateMetrics(prisma, scheduledReport.org_id, dateRange);

    const completedExecution = await prisma.report_executions.update({
      where: { id: execution.id },
      data: {
        status: 'completed',
        generated_at: new Date().toISOString(),
      },
    });

    // Atualizar next_run_at do scheduled_report
    await prisma.scheduled_reports.update({
      where: { id: scheduledReport.id },
      data: { last_run_at: new Date().toISOString() },
    });

    return {
      execution: completedExecution,
      template,
      metrics,
      dateRange,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    await prisma.report_executions.update({
      where: { id: execution.id },
      data: {
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
      },
    });
    throw error;
  }
}

/**
 * Formata o relatório como texto para envio (WhatsApp, email, etc.)
 */
export function formatReportText(data: ReportData): string {
  const { metrics, dateRange, template } = data;
  const { totals } = metrics;

  const currency = 'BRL';
  const formatMoney = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency });
  const formatPercent = (v: number) => `${(v * 100).toFixed(1)}%`;

  const lines = [
    `📊 *${template.name}*`,
    `📅 Período: ${dateRange.from} → ${dateRange.to}`,
    ``,
    `💰 *KPIs Gerais*`,
    `• Gasto total: ${formatMoney(totals.spend)}`,
    `• Receita atribuída: ${formatMoney(totals.revenue)}`,
    `• Lucro bruto: ${formatMoney(totals.profit)}`,
    `• ROAS: ${totals.roas.toFixed(2)}x`,
    `• Conversões: ${totals.conversions}`,
    ``,
  ];

  if (metrics.by_campaign.length > 0) {
    lines.push(`🏆 *Top Campanhas por Lucro*`);
    const sorted = [...metrics.by_campaign].sort((a, b) => b.profit - a.profit).slice(0, 5);
    for (const c of sorted) {
      lines.push(`• ${c.campaign_name}: ${formatMoney(c.profit)} (ROAS ${c.roas.toFixed(2)}x)`);
    }
  }

  lines.push(``, `_Gerado em ${new Date().toLocaleString('pt-BR')}_`);

  return lines.join('\n');
}

/**
 * Calcula o date range baseado na frequência do relatório
 */
function resolveDateRange(frequency: ScheduledReport['frequency']): DateRange {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);

  switch (frequency) {
    case 'daily': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { from: fmt(yesterday), to: fmt(yesterday) };
    }
    case 'weekly': {
      const end = new Date(today);
      end.setDate(end.getDate() - 1);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      return { from: fmt(start), to: fmt(end) };
    }
    case 'monthly': {
      const end = new Date(today);
      end.setDate(end.getDate() - 1);
      const start = new Date(end.getFullYear(), end.getMonth(), 1);
      return { from: fmt(start), to: fmt(end) };
    }
  }
}
