/**
 * @start-metric/attribution
 * Motor de atribuição de conversões
 *
 * Fornece um motor de atribuição last-click para vincular conversões
 * (orders) às campanhas de marketing correspondentes.
 *
 * @example
 * ```ts
 * import { createAttributionEngine } from '@start-metric/attribution';
 * import { PrismaClient } from '@prisma/client';
 *
 * const prisma = new PrismaClient();
 * const engine = createAttributionEngine(prisma);
 *
 * // Registrar tracking
 * await engine.recordTracking({ org_id, campaign_id, ... });
 *
 * // Atribuir order
 * const result = await engine.attributeOrder(order);
 * ```
 */

export * from './types.js';
export * from './engine.js';
