/**
 * @start-metric/attribution
 * Motor de atribuição last-click
 *
 * Este módulo implementa a lógica de atribuição de conversões às campanhas
 * de marketing. O modelo padrão é "last-click", que atribui a conversão
 * ao último toque (click) antes da compra.
 */

import type { Order, OrderMetadata, Attribution, TrackingSession } from '@start-metric/types';
import type { AttributionOptions, TrackingData, AttributionResult, ExtendedOrderMetadata } from './types.js';

/**
 * PrismaClient com tabelas de atribuição
 */
export type AttributionPrismaClient = {
  tracking_sessions: {
    create: (data: any) => Promise<TrackingSession>;
    findFirst: (args: any) => Promise<TrackingSession | null>;
    update: (args: any) => Promise<TrackingSession>;
  };
  attributions: {
    create: (data: any) => Promise<Attribution>;
  };
  campaigns: {
    findFirst: (args: any) => Promise<{ id: string } | null>;
  };
};

/**
 * Motor de atribuição
 */
export class AttributionEngine {
  constructor(private readonly prisma: AttributionPrismaClient) {}

  /**
   * Registra um evento de tracking (landing page visit)
   */
  async recordTracking(data: TrackingData): Promise<TrackingSession> {
    const click_id = this.generateClickId(data);

    const session = await this.prisma.tracking_sessions.create({
      data: {
        id: this.generateId(),
        org_id: data.org_id,
        click_id,
        campaign_id: data.campaign_id || null,
        adset_id: data.adset_id || null,
        ad_id: data.ad_id || null,
        utm_source: data.utm_source || null,
        utm_medium: data.utm_medium || null,
        utm_campaign: data.utm_campaign || null,
        fbc: data.fbc || null,
        fbp: data.fbp || null,
        ip_address: data.ip_address || null,
        user_agent: data.user_agent || null,
        landed_at: new Date(),
        converted_at: null,
      },
    });

    return session;
  }

  /**
   * Atribui uma order à campanha correspondente
   */
  async attributeOrder(
    order: Order,
    options: AttributionOptions = {},
  ): Promise<AttributionResult> {
    const {
      model = 'last_click',
      conversionWindowDays = 30,
      fallbackToUtm = false,
    } = options;

    // Extrair metadata da order
    const metadata = this.parseOrderMetadata(order);

    if (!metadata) {
      return this.noAttribution(order, 'no_metadata');
    }

    // Buscar sessão de tracking
    const session = await this.findTrackingSession(
      order.org_id,
      metadata,
      conversionWindowDays,
    );

    if (session) {
      // Criar atribuição com base na sessão
      const attribution = await this.createAttribution(
        order,
        session,
        model,
        'high',
      );
      return {
        order,
        attribution,
        session,
        confidence: 'high',
        method: model,
      };
    }

    // Fallback para UTM se configurado
    if (fallbackToUtm && (metadata.utm_campaign || metadata.fbclid)) {
      const utmAttribution = await this.attributeByUtm(order, metadata, model);
      if (utmAttribution) {
        return {
          order,
          attribution: utmAttribution,
          session: null,
          confidence: 'medium',
          method: 'utm',
        };
      }
    }

    return this.noAttribution(order, 'no_session_found');
  }

  /**
   * Marca uma sessão como convertida
   */
  async markAsConverted(sessionId: string): Promise<void> {
    await this.prisma.tracking_sessions.update({
      where: { id: sessionId },
      data: { converted_at: new Date() },
    });
  }

  /**
   * Atribui uma order usando parâmetros UTM
   */
  private async attributeByUtm(
    order: Order,
    metadata: ExtendedOrderMetadata,
    model: string,
  ): Promise<Attribution | null> {
    // Buscar campanha pelo nome (utm_campaign ou fbclid)
    const campaign = await this.prisma.campaigns.findFirst({
      where: {
        org_id: order.org_id,
        name: metadata.utm_campaign || undefined,
      },
    });

    if (!campaign) {
      return null;
    }

    return this.prisma.attributions.create({
      data: {
        id: this.generateId(),
        org_id: order.org_id,
        order_id: order.id,
        campaign_id: campaign.id,
        adset_id: null,
        ad_id: null,
        attribution_model: model as any,
        revenue_attributed: order.amount_total,
        attributed_at: new Date(),
      },
    });
  }

  /**
   * Cria uma atribuição no banco
   */
  private async createAttribution(
    order: Order,
    session: TrackingSession,
    model: string,
    confidence: 'high' | 'medium' | 'low',
  ): Promise<Attribution> {
    return this.prisma.attributions.create({
      data: {
        id: this.generateId(),
        org_id: order.org_id,
        order_id: order.id,
        campaign_id: session.campaign_id,
        adset_id: session.adset_id,
        ad_id: session.ad_id,
        attribution_model: model as any,
        revenue_attributed: order.amount_total,
        attributed_at: new Date(),
      },
    });
  }

  /**
   * Busca sessão de tracking
   */
  private async findTrackingSession(
    orgId: string,
    metadata: ExtendedOrderMetadata,
    windowDays: number,
  ): Promise<TrackingSession | null> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - windowDays);

    // Prioridade 1: click_id
    if (metadata.click_id) {
      const session = await this.prisma.tracking_sessions.findFirst({
        where: {
          org_id: orgId,
          click_id: metadata.click_id,
          landed_at: { gte: cutoffDate },
        },
      });
      if (session) return session;
    }

    // Prioridade 2: fbclid (ou fbc se disponível)
    const fbcValue = metadata.fbclid || metadata.fbc;
    if (fbcValue) {
      const session = await this.prisma.tracking_sessions.findFirst({
        where: {
          org_id: orgId,
          fbc: fbcValue,
          landed_at: { gte: cutoffDate },
        },
      });
      if (session) return session;
    }

    // Prioridade 3: UTM match
    if (metadata.utm_source && metadata.utm_campaign) {
      const session = await this.prisma.tracking_sessions.findFirst({
        where: {
          org_id: orgId,
          utm_source: metadata.utm_source,
          utm_campaign: metadata.utm_campaign,
          landed_at: { gte: cutoffDate },
        },
        orderBy: { landed_at: 'desc' as const },
      });
      if (session) return session;
    }

    return null;
  }

  /**
   * Retorna resultado sem atribuição
   */
  private noAttribution(order: Order, reason: string): AttributionResult {
    return {
      order,
      attribution: null,
      session: null,
      confidence: 'low',
      method: 'none',
    };
  }

  /**
   * Extrai metadata da order
   */
  private parseOrderMetadata(order: Order): ExtendedOrderMetadata | null {
    if (!order.metadata || typeof order.metadata !== 'object') {
      return null;
    }
    return order.metadata as ExtendedOrderMetadata;
  }

  /**
   * Gera um click_id único
   */
  private generateClickId(data: TrackingData): string {
    if (data.click_id) return data.click_id;

    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    return `clk_${timestamp}_${random}`;
  }

  /**
   * Gera um ID único
   */
  private generateId(): string {
    return `attr_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }
}

/**
 * Cria uma instância do motor de atribuição
 */
export function createAttributionEngine(prisma: AttributionPrismaClient): AttributionEngine {
  return new AttributionEngine(prisma);
}
