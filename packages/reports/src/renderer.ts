/**
 * @start-metric/reports
 * Template Renderer — Motor de renderização de templates com variáveis
 */

export interface RenderResult {
  rendered: string;
  warnings: string[]; // nomes das variáveis não encontradas
}

export interface TemplateVariables {
  // Cliente
  client_name: string;
  period: string;

  // Financeiro
  total_spend: string;
  total_revenue: string;
  roas: string;
  cpa: string;
  roi: string;
  gross_profit: string;

  // Alcance
  impressions: string;
  clicks: string;
  ctr: string;
  cpm: string;
  cpc: string;

  // Conversões
  conversions: string;

  // Destaque
  best_campaign: string;
  worst_campaign: string;
}

/**
 * Substitui variáveis no formato {{variavel}} pelos valores fornecidos
 */
export function renderTemplate(
  template: string,
  variables: Partial<TemplateVariables>,
): RenderResult {
  const warnings: string[] = [];

  const rendered = template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const trimmed = key.trim();

    if (trimmed in variables && variables[trimmed as keyof TemplateVariables] !== undefined) {
      return String(variables[trimmed as keyof TemplateVariables]);
    }

    warnings.push(trimmed);
    return match; // manter original se não encontrado
  });

  return { rendered, warnings };
}

/**
 * Formata valores brutos em strings formatadas (pt-BR)
 * Retorna apenas as variáveis de métricas (exclui client_name, period, best_campaign, worst_campaign)
 */
export function formatVariables(raw: {
  totalSpend?: number;
  totalRevenue?: number;
  roas?: number;
  cpa?: number;
  roi?: number;
  grossProfit?: number;
  impressions?: number;
  clicks?: number;
  ctr?: number;
  cpm?: number;
  cpc?: number;
  conversions?: number;
}): Pick<TemplateVariables, 'total_spend' | 'total_revenue' | 'roas' | 'cpa' | 'roi' | 'gross_profit' | 'impressions' | 'clicks' | 'ctr' | 'cpm' | 'cpc' | 'conversions'> {
  const currency = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });

  const number = new Intl.NumberFormat('pt-BR');

  return {
    total_spend: currency.format(raw.totalSpend ?? 0),
    total_revenue: currency.format(raw.totalRevenue ?? 0),
    roas: `${(raw.roas ?? 0).toFixed(1)}x`,
    cpa: currency.format(raw.cpa ?? 0),
    roi: `${(raw.roi ?? 0).toFixed(0)}%`,
    gross_profit: currency.format(raw.grossProfit ?? 0),
    impressions: number.format(raw.impressions ?? 0),
    clicks: number.format(raw.clicks ?? 0),
    ctr: `${(raw.ctr ?? 0).toFixed(1)}%`,
    cpm: currency.format(raw.cpm ?? 0),
    cpc: currency.format(raw.cpc ?? 0),
    conversions: number.format(raw.conversions ?? 0),
  };
}

/**
 * Formata período para exibição
 */
export function formatPeriod(from: string, to: string): string {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const fromTime = fromDate.getTime();
  const toTime = toDate.getTime();

  if (fromTime === toTime) {
    return formatDate(fromDate);
  }

  return `${formatDate(fromDate)} a ${formatDate(toDate)}`;
}
