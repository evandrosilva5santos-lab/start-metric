/**
 * @start-metric/reports
 * Report Builder — geração e agendamento de relatórios automáticos
 *
 * @example
 * ```ts
 * import { buildReport, formatReportText } from '@start-metric/reports';
 *
 * const data = await buildReport(prisma, scheduledReport);
 * const text = formatReportText(data);
 * ```
 */

export { aggregateMetrics } from './aggregator.js';
export type { ReportsPrismaClient } from './aggregator.js';

export { buildReport, formatReportText } from './builder.js';
export type { ReportData, ReportBuilderPrismaClient } from './builder.js';

export { getPendingReports, rescheduleReport, calculateNextRun } from './scheduler.js';
export type { SchedulerPrismaClient } from './scheduler.js';

export { renderTemplate, formatVariables, formatPeriod } from './renderer.js';
export type { RenderResult, TemplateVariables } from './renderer.js';

export { buildVariables } from './variables.js';
