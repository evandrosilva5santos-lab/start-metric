/**
 * @start-metric/whatsapp
 * Report Sender — envia relatórios via WhatsApp (Evolution API)
 */

import { EvolutionClient } from './client.js';
import type { SendResult } from './types.js';

export interface WhatsAppSenderPrismaClient {
  whatsapp_instances: {
    findFirst: (args: any) => Promise<{
      id: string;
      instance_name: string;
      api_url: string;
      api_key: string;
      status: string;
    } | null>;
  };
  whatsapp_messages: {
    create: (args: any) => Promise<{ id: string }>;
    update: (args: any) => Promise<{ id: string }>;
  };
}

export interface SendReportOptions {
  orgId: string;
  phoneNumber: string;
  message: string;
  reportExecutionId?: string;
}

/**
 * Envia uma mensagem de relatório via WhatsApp usando a instância configurada da org
 */
export async function sendReportViaWhatsApp(
  prisma: WhatsAppSenderPrismaClient,
  options: SendReportOptions,
): Promise<SendResult> {
  const instance = await prisma.whatsapp_instances.findFirst({
    where: {
      org_id: options.orgId,
      status: 'connected',
    },
  });

  if (!instance) {
    return {
      success: false,
      error: 'No connected WhatsApp instance found for this organization',
    };
  }

  const messageRecord = await prisma.whatsapp_messages.create({
    data: {
      org_id: options.orgId,
      instance_id: instance.id,
      report_execution_id: options.reportExecutionId ?? null,
      to: options.phoneNumber,
      message: options.message,
      status: 'pending',
      created_at: new Date().toISOString(),
    },
  });

  const client = new EvolutionClient(
    instance.api_url,
    instance.api_key,
  );

  const result = await client.sendText(
    instance.instance_name,
    options.phoneNumber,
    options.message,
  );

  await prisma.whatsapp_messages.update({
    where: { id: messageRecord.id },
    data: {
      status: result.success ? 'sent' : 'failed',
      error_message: result.error ?? null,
      sent_at: result.success ? new Date().toISOString() : null,
    },
  });

  return result;
}

/**
 * Envia para múltiplos destinatários
 */
export async function sendReportToRecipients(
  prisma: WhatsAppSenderPrismaClient,
  orgId: string,
  phoneNumbers: string[],
  message: string,
  reportExecutionId?: string,
): Promise<SendResult[]> {
  return Promise.all(
    phoneNumbers.map((phone) =>
      sendReportViaWhatsApp(prisma, {
        orgId,
        phoneNumber: phone,
        message,
        reportExecutionId,
      }),
    ),
  );
}
