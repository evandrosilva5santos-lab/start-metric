/**
 * @start-metric/whatsapp
 * Tipos para Evolution API (WhatsApp)
 */

export interface EvolutionConfig {
  apiUrl: string;
  apiKey: string;
}

export interface SendTextPayload {
  number: string;
  text: string;
  delay?: number;
}

export interface SendTextResponse {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message: {
    conversation: string;
  };
  messageTimestamp: number;
  status: string;
}

export interface InstanceInfo {
  instance: {
    instanceName: string;
    owner: string;
    profileName?: string;
    profilePictureUrl?: string;
    status?: string;
  };
}

export interface ConnectionState {
  instance: {
    instanceName: string;
    state: 'open' | 'close' | 'connecting';
  };
}

export interface CreateInstancePayload {
  instanceName: string;
  token?: string;
  qrcode?: boolean;
  webhook?: string;
  webhookByEvents?: boolean;
  webhookBase64?: boolean;
  events?: string[];
}

export interface CreateInstanceResponse {
  instance: {
    instanceName: string;
    status: string;
  };
  hash: {
    apikey: string;
  };
  qrcode?: {
    pairingCode: string | null;
    code: string;
    base64: string;
    count: number;
  };
}

export interface QRCodeResponse {
  base64: string;
}

export interface DeleteInstanceResponse {
  deleted?: boolean;
}

export interface EvolutionApiError {
  status: number;
  error: string;
  response?: {
    message: string;
  };
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
