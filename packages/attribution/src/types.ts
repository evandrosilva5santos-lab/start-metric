/**
 * @start-metric/attribution
 * Tipos para motor de atribuição
 */

import type { Order, OrderMetadata, Attribution, TrackingSession } from '@start-metric/types';

/**
 * Estende OrderMetadata com campos adicionais
 */
export interface ExtendedOrderMetadata extends OrderMetadata {
  fbc?: string;
  fbp?: string;
}

/**
 * Resultado da atribuição de uma order
 */
export interface AttributionResult {
  order: Order;
  attribution: Attribution | null;
  session: TrackingSession | null;
  confidence: 'high' | 'medium' | 'low';
  method: 'last_click' | 'first_click' | 'linear' | 'utm' | 'none';
}

/**
 * Dados de tracking para criar uma nova sessão
 */
export interface TrackingData {
  org_id: string;
  click_id?: string;
  campaign_id?: string;
  adset_id?: string;
  ad_id?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbclid?: string;
  gclid?: string;
  ttclid?: string;
  fbc?: string;
  fbp?: string;
  page_url?: string;
  referrer?: string;
  ip_address?: string;
  user_agent?: string;
}

/**
 * Opções do motor de atribuição
 */
export interface AttributionOptions {
  /**
   * Modelo de atribuição
   * @default 'last_click'
   */
  model?: 'last_click' | 'first_click' | 'linear';

  /**
   * Janela de conversão em dias (padrão: 30 dias)
   * @default 30
   */
  conversionWindowDays?: number;

  /**
   * Criar atribuição mesmo sem sessão correspondente (usando UTM)
   * @default false
   */
  fallbackToUtm?: boolean;
}
