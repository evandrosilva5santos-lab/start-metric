export class EvolutionApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = 'EvolutionApiError';
  }
}

export class EvolutionClient {
  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string
  ) { }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'apikey': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText }));
      throw new EvolutionApiError(error.message, res.status);
    }

    return res.json();
  }

  async createInstance(instanceName: string): Promise<{ instance: { instanceName: string } }> {
    return this.request('POST', '/instance/create', {
      instanceName,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS'
    });
  }

  async setWebhook(instanceName: string, url: string): Promise<unknown> {
    return this.request('POST', `/webhook/set/${instanceName}`, {
      enabled: true,
      url,
      webhookByEvents: false,
      events: [
        "QRCODE_UPDATED",
        "CONNECTION_UPDATE"
      ]
    });
  }

  async fetchGroups(instanceName: string): Promise<any[]> {
    return this.request('GET', `/group/fetchAllGroups/${instanceName}?getParticipants=true`);
  }

  async getQRCode(instanceName: string): Promise<{ base64: string }> {
    return this.request('GET', `/instance/connect/${instanceName}`);
  }

  async getConnectionState(instanceName: string): Promise<{ instance: { state: 'open' | 'close' | 'connecting' } }> {
    return this.request('GET', `/instance/connectionState/${instanceName}`);
  }

  async deleteInstance(instanceName: string): Promise<{ deleted: boolean }> {
    return this.request('DELETE', `/instance/delete/${instanceName}`);
  }

  async sendText(instanceName: string, phone: string, text: string): Promise<unknown> {
    return this.request('POST', `/message/sendText/${instanceName}`, {
      number: phone,
      textMessage: { text }
    });
  }
}

export function createEvolutionClient(): EvolutionClient {
  const url = process.env.EVOLUTION_API_URL || process.env.EVOLUTION_API_BASE_URL;
  const key = process.env.EVOLUTION_API_KEY || process.env.EVOLUTION_API_GLOBAL_TOKEN;
  if (!url || !key) throw new Error('EVOLUTION_API_URL and EVOLUTION_API_KEY are required');

  // Limpa trailing slash se existir na URL
  const cleanUrl = url.endsWith('/') ? url.slice(0, -1) : url;
  return new EvolutionClient(cleanUrl, key);
}