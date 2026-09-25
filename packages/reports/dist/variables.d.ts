/**
 * @start-metric/reports
 * Variables Builder — Constrói variáveis para templates baseado em métricas reais
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TemplateVariables } from './renderer.js';
interface BuildVariablesOptions {
    orgId: string;
    clientId: string;
    dateRange: {
        from: string;
        to: string;
    };
}
/**
 * Busca métricas reais do cliente no período e constrói variáveis para o template
 */
export declare function buildVariables(supabase: SupabaseClient, { orgId, clientId, dateRange }: BuildVariablesOptions): Promise<Partial<TemplateVariables>>;
export {};
