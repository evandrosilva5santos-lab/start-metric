/**
 * @start-metric/whatsapp
 * Cliente Evolution API para automação de WhatsApp
 *
 * @example
 * ```ts
 * import { EvolutionClient } from '@start-metric/whatsapp';
 *
 * const client = new EvolutionClient({ apiUrl: '...', apiKey: '...' });
 * const result = await client.sendText('instance-name', '5511999998888', 'Olá!');
 * ```
 */

export { EvolutionClient, EvolutionApiError, createEvolutionClient } from './client.js';
export type {
  EvolutionConfig,
  SendResult,
  SendTextResponse,
  ConnectionState,
  CreateInstancePayload,
  QRCodeResponse,
  DeleteInstanceResponse,
} from './types.js';

export { dailyReportTemplate, roasAlertTemplate, spendNoConversionTemplate } from './templates.js';

export { sendReportViaWhatsApp, sendReportToRecipients } from './sender.js';
export type { WhatsAppSenderPrismaClient, SendReportOptions } from './sender.js';
