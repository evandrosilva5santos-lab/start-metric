/**
 * @start-metric/whatsapp
 * Cliente Evolution API (WhatsApp)
 *
 * @example
 * ```ts
 * const client = new EvolutionClient({
 *   apiUrl: 'https://evolution.myapp.com',
 *   apiKey: 'my-api-key',
 * });
 *
 * await client.sendText('my-instance', '5511999998888', 'Olá!');
 * ```
 */

import type {
  EvolutionConfig,
  SendTextResponse,
  InstanceInfo,
  ConnectionState,
  CreateInstancePayload,
  CreateInstanceResponse,
  SendResult,
  QRCodeResponse,
  DeleteInstanceResponse,
} from './types.js';

export class EvolutionApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'EvolutionApiError';
  }
}

/**
 * Cliente para Evolution API (self-hosted WhatsApp gateway)
 */
export class EvolutionClient {
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(config: EvolutionConfig) {
    this.apiUrl = config.apiUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await fetch(`${this.apiUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        apikey: this.apiKey,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const data = await res
      .json()
      .catch(() => null) as T | { error?: string; message?: string; response?: { message?: string } } | null;

    if (!res.ok) {
      const err = data as { error?: string; message?: string; response?: { message?: string } } | null;
      const message = err?.response?.message ?? err?.message ?? err?.error ?? `Evolution API error ${res.status}`;
      throw new EvolutionApiError(message, res.status);
    }

    return (data ?? {}) as T;
  }

  /**
   * Envia uma mensagem de texto simples
   */
  async sendText(
    instanceName: string,
    number: string,
    text: string,
    delay = 1000,
  ): Promise<SendResult> {
    try {
      const response = await this.request<SendTextResponse>(
        'POST',
        `/message/sendText/${instanceName}`,
        {
          number,
          textMessage: { text },
          text,
          delay,
        },
      );

      return {
        success: true,
        messageId: response.key?.id,
      };
    } catch (err) {
      if (err instanceof EvolutionApiError) {
        return { success: false, error: err.message };
      }
      throw err;
    }
  }

  /**
   * Cria uma nova instância WhatsApp
   */
  async createInstance(payload: CreateInstancePayload | string): Promise<CreateInstanceResponse> {
    if (typeof payload === 'string') {
      return this.request<CreateInstanceResponse>('POST', '/instance/create', {
        instanceName: payload,
        qrcode: true,
      });
    }
    return this.request<CreateInstanceResponse>('POST', '/instance/create', payload);
  }

  /**
   * Inicia fluxo de conexão e retorna QR code base64
   */
  async getQRCode(instanceName: string): Promise<QRCodeResponse> {
    return this.request<QRCodeResponse>('GET', `/instance/connect/${instanceName}`);
  }

  /**
   * Retorna o estado de conexão de uma instância
   */
  async getConnectionState(instanceName: string): Promise<ConnectionState> {
    return this.request<ConnectionState>('GET', `/instance/connectionState/${instanceName}`);
  }

  /**
   * Alias semântico para o estado da instância
   */
  async getInstanceStatus(instanceName: string): Promise<ConnectionState> {
    return this.getConnectionState(instanceName);
  }

  /**
   * Retorna informações de uma instância
   */
  async getInstance(instanceName: string): Promise<InstanceInfo> {
    return this.request<InstanceInfo>('GET', `/instance/fetchInstances?instanceName=${instanceName}`);
  }

  /**
   * Verifica se a instância está conectada
   */
  async isConnected(instanceName: string): Promise<boolean> {
    try {
      const state = await this.getConnectionState(instanceName);
      return state.instance.state === 'open';
    } catch {
      return false;
    }
  }

  /**
   * Deleta uma instância
   */
  async deleteInstance(instanceName: string): Promise<DeleteInstanceResponse> {
    const response = await this.request<DeleteInstanceResponse | Record<string, unknown>>(
      'DELETE',
      `/instance/delete/${instanceName}`,
    );

    if (typeof response === 'object' && response && 'deleted' in response) {
      return { deleted: Boolean((response as DeleteInstanceResponse).deleted) };
    }

    return { deleted: true };
  }
}

export function createEvolutionClient(): EvolutionClient {
  const apiUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;

  if (!apiUrl || !apiKey) {
    throw new Error('EVOLUTION_API_URL and EVOLUTION_API_KEY are required');
  }

  return new EvolutionClient({ apiUrl, apiKey });
}
