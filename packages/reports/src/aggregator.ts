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

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') return parseFloat(value) || 0;
  if (value && typeof value === 'object' && 'toNumber' in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return 0;
}

function safeDivide(a: number, b: number): number {
  return b > 0 ? a / b : 0;
}

/**
 * Agrega métricas de campanhas no período especificado
 */
export async function aggregateMetrics(
  prisma: ReportsPrismaClient,
  orgId: string,
  dateRange: DateRange,
): Promise<AggregatedMetrics> {
  const metricsRows = await prisma.daily_metrics.findMany({
    where: {
      org_id: orgId,
      date: {
        gte: new Date(`${dateRange.from}T00:00:00Z`),
        lte: new Date(`${dateRange.to}T23:59:59Z`),
      },
    },
    include: {
      campaigns: {
        select: { id: true, name: true },
      },
    },
  });

  const campaignMap = new Map<
    string,
    {
      campaign_id: string;
      campaign_name: string;
      spend: number;
      revenue: number;
      conversions: number;
    }
  >();

  let totalSpend = 0;
  let totalRevenue = 0;
  let totalConversions = 0;

  for (const row of metricsRows) {
    const cid = row.campaign_id as string;
    const spend = toNumber(row.spend);
    const revenue = toNumber(row.revenue_attributed);
    const conversions = toNumber(row.conversions);

    totalSpend += spend;
    totalRevenue += revenue;
    totalConversions += conversions;

    const existing = campaignMap.get(cid) ?? {
      campaign_id: cid,
      campaign_name: (row.campaigns as any)?.name ?? cid,
      spend: 0,
      revenue: 0,
      conversions: 0,
    };

    existing.spend += spend;
    existing.revenue += revenue;
    existing.conversions += conversions;
    campaignMap.set(cid, existing);
  }

  const totalProfit = totalRevenue - totalSpend;

  const by_campaign = Array.from(campaignMap.values()).map((c) => ({
    campaign_id: c.campaign_id,
    campaign_name: c.campaign_name,
    spend: c.spend,
    revenue: c.revenue,
    roas: safeDivide(c.revenue, c.spend),
    conversions: c.conversions,
    profit: c.revenue - c.spend,
  }));

  return {
    period: dateRange,
    by_campaign,
    by_adset: [],
    totals: {
      spend: totalSpend,
      revenue: totalRevenue,
      roas: safeDivide(totalRevenue, totalSpend),
      conversions: totalConversions,
      profit: totalProfit,
    },
  };
}
