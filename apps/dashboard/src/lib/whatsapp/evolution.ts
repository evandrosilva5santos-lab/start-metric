export type WhatsAppInstanceStatus =
  | "pending"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error"
  | "deleted";

export type EvolutionConnectionState = "open" | "close" | "connecting" | string;

export interface EvolutionConnectionResponse {
  instance: {
    state: EvolutionConnectionState;
  };
}

export interface EvolutionCreateInstanceResponse {
  instance?: {
    instanceName?: string;
    status?: string;
  };
  qrcode?: {
    base64?: string;
  };
}

export interface EvolutionQRCodeResponse {
  base64?: string;
}

export interface EvolutionDeleteInstanceResponse {
  deleted?: boolean;
}

export interface EvolutionSendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export class EvolutionApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "EvolutionApiError";
  }
}

export class EvolutionClient {
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(apiUrl: string, apiKey: string) {
    this.apiUrl = apiUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
  }

  private async request<T>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    body?: unknown,
  ): Promise<T> {
    const response = await fetch(`${this.apiUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        apikey: this.apiKey,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const json = await response
      .json()
      .catch(() => null) as Record<string, unknown> | null;

    if (!response.ok) {
      const message =
        (typeof json?.response === "object" && json?.response && "message" in json.response
          ? String((json.response as { message?: unknown }).message ?? "")
          : "") ||
        (typeof json?.message === "string" ? json.message : "") ||
        (typeof json?.error === "string" ? json.error : "") ||
        `Evolution API error ${response.status}`;

      throw new EvolutionApiError(message, response.status);
    }

    return (json ?? {}) as T;
  }

  async createInstance(instanceName: string): Promise<EvolutionCreateInstanceResponse> {
    return this.request<EvolutionCreateInstanceResponse>("POST", "/instance/create", {
      instanceName,
      qrcode: true,
    });
  }

  async getQRCode(instanceName: string): Promise<EvolutionQRCodeResponse> {
    return this.request<EvolutionQRCodeResponse>("GET", `/instance/connect/${instanceName}`);
  }

  async getConnectionState(instanceName: string): Promise<EvolutionConnectionResponse> {
    return this.request<EvolutionConnectionResponse>("GET", `/instance/connectionState/${instanceName}`);
  }

  async deleteInstance(instanceName: string): Promise<EvolutionDeleteInstanceResponse> {
    return this.request<EvolutionDeleteInstanceResponse>("DELETE", `/instance/delete/${instanceName}`);
  }

  async sendText(
    instanceName: string,
    phone: string,
    text: string,
  ): Promise<EvolutionSendResult> {
    try {
      const result = await this.request<{ key?: { id?: string } }>(
        "POST",
        `/message/sendText/${instanceName}`,
        {
          number: phone,
          textMessage: { text },
          text,
        },
      );

      return {
        success: true,
        messageId: result.key?.id,
      };
    } catch (error) {
      if (error instanceof EvolutionApiError) {
        return {
          success: false,
          error: error.message,
        };
      }
      throw error;
    }
  }
}

export function createEvolutionClient(): EvolutionClient {
  const apiUrl = process.env.EVOLUTION_API_URL?.trim();
  const apiKey = process.env.EVOLUTION_API_KEY?.trim();

  if (!apiUrl || !apiKey) {
    throw new Error("EVOLUTION_API_URL and EVOLUTION_API_KEY are required");
  }

  return new EvolutionClient(apiUrl, apiKey);
}

export function mapEvolutionStateToStatus(state: EvolutionConnectionState): WhatsAppInstanceStatus {
  if (state === "open") return "connected";
  if (state === "connecting") return "connecting";
  if (state === "close") return "disconnected";
  return "error";
}

