import { Injectable } from '@nestjs/common';

interface MetaApiErrorData {
  code?: number;
  message?: string;
}

type GraphApiParams = Record<string, string | number | boolean | undefined>;
type MetaProfileResponse = {
  id: string;
  name?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractMetaApiError(value: unknown): MetaApiErrorData | undefined {
  if (!isRecord(value)) return undefined;
  const maybeError = value.error;
  if (!isRecord(maybeError)) return undefined;

  const code =
    typeof maybeError.code === 'number' ? maybeError.code : undefined;
  const message =
    typeof maybeError.message === 'string' ? maybeError.message : undefined;

  return { code, message };
}

export class MetaApiError extends Error {
  constructor(
    public message: string,
    public code?: number,
  ) {
    super(message);
  }

  isTokenExpired(): boolean {
    return this.code === 190; // Invalid OAuth token
  }

  isRateLimited(): boolean {
    return this.code === 17 || this.code === 4; // Rate limit or API call limit
  }
}

@Injectable()
export class MetaService {
  private readonly graphApiUrl = 'https://graph.instagram.com/v20.0';
  private readonly maxRetries = 3;
  private readonly baseRetryDelayMs = 500;

  async fetchAdAccounts(
    token: string,
  ): Promise<Record<string, unknown> | unknown[]> {
    return this.callGraphApi<Record<string, unknown> | unknown[]>(
      'me/adaccounts',
      token,
      {
        fields: 'id,name,account_status,currency,timezone',
      },
    );
  }

  async fetchCampaigns(
    adAccountId: string,
    token: string,
  ): Promise<Record<string, unknown> | unknown[]> {
    return this.callGraphApi<Record<string, unknown> | unknown[]>(
      `${adAccountId}/campaigns`,
      token,
      {
        fields: 'id,name,status,objective,daily_budget,budget_remaining',
      },
    );
  }

  async fetchInsights(
    adAccountId: string,
    token: string,
    dateRange?: { startDate: string; endDate: string },
  ): Promise<Record<string, unknown> | unknown[]> {
    const params: GraphApiParams = {
      fields:
        'campaign_id,campaign_name,spend,conversions,reach,impressions,ctr,cpc',
      time_range: dateRange ? JSON.stringify(dateRange) : undefined,
      level: 'campaign',
      time_increment: 1,
    };

    return this.callGraphApi<Record<string, unknown> | unknown[]>(
      `${adAccountId}/insights`,
      token,
      params,
    );
  }

  async validateToken(token: string): Promise<MetaProfileResponse | null> {
    try {
      const response = await this.callGraphApi<MetaProfileResponse>(
        'me',
        token,
        {
          fields: 'id,name,email',
        },
      );

      return {
        id: response.id,
        name: response.name,
      };
    } catch (error: unknown) {
      if (error instanceof MetaApiError && error.isTokenExpired()) {
        return null;
      }
      throw error;
    }
  }

  private async callGraphApi<T extends Record<string, unknown> | unknown[]>(
    endpoint: string,
    token: string,
    params: GraphApiParams = {},
    attempt = 1,
  ): Promise<T> {
    const url = new URL(`${this.graphApiUrl}/${endpoint}`);
    url.searchParams.append('access_token', token);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });

    try {
      const response = await fetch(url.toString());
      const data: unknown = await response.json();

      if (!response.ok) {
        const error = extractMetaApiError(data);
        const metaError = new MetaApiError(
          error?.message || 'Unknown error',
          error?.code,
        );
        throw metaError;
      }

      return data as T;
    } catch (error: unknown) {
      // Retry logic for 5xx errors
      const shouldRetry =
        error instanceof TypeError ||
        (error instanceof MetaApiError &&
          typeof error.code === 'number' &&
          error.code >= 500);

      if (shouldRetry) {
        if (attempt <= this.maxRetries) {
          const delay = this.baseRetryDelayMs * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.callGraphApi(endpoint, token, params, attempt + 1);
        }
      }

      throw error;
    }
  }
}
