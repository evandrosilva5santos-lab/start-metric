/**
 * @start-metric/reports
 * Template Renderer — Motor de renderização de templates com variáveis
 */
export interface RenderResult {
    rendered: string;
    warnings: string[];
}
export interface TemplateVariables {
    client_name: string;
    period: string;
    total_spend: string;
    total_revenue: string;
    roas: string;
    cpa: string;
    roi: string;
    gross_profit: string;
    impressions: string;
    clicks: string;
    ctr: string;
    cpm: string;
    cpc: string;
    conversions: string;
    best_campaign: string;
    worst_campaign: string;
}
/**
 * Substitui variáveis no formato {{variavel}} pelos valores fornecidos
 */
export declare function renderTemplate(template: string, variables: Partial<TemplateVariables>): RenderResult;
/**
 * Formata valores brutos em strings formatadas (pt-BR)
 * Retorna apenas as variáveis de métricas (exclui client_name, period, best_campaign, worst_campaign)
 */
export declare function formatVariables(raw: {
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
}): Pick<TemplateVariables, 'total_spend' | 'total_revenue' | 'roas' | 'cpa' | 'roi' | 'gross_profit' | 'impressions' | 'clicks' | 'ctr' | 'cpm' | 'cpc' | 'conversions'>;
/**
 * Formata período para exibição
 */
export declare function formatPeriod(from: string, to: string): string;
