import { Injectable } from '@nestjs/common';

interface MetaApiErrorData {
  code?: number;
  message?: string;
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

  async fetchAdAccounts(token: string) {
    return this.callGraphApi('me/adaccounts', token, {
      fields: 'id,name,account_status,currency,timezone',
    });
  }

  async fetchCampaigns(adAccountId: string, token: string) {
    return this.callGraphApi(`${adAccountId}/campaigns`, token, {
      fields: 'id,name,status,objective,daily_budget,budget_remaining',
    });
  }

  async fetchInsights(
    adAccountId: string,
    token: string,
    dateRange?: { startDate: string; endDate: string },
  ) {
    const params: Record<string, any> = {
      fields: 'campaign_id,campaign_name,spend,conversions,reach,impressions,ctr,cpc',
      time_range: dateRange ? JSON.stringify(dateRange) : undefined,
      level: 'campaign',
      time_increment: 1,
    };

    return this.callGraphApi(`${adAccountId}/insights`, token, params);
  }

  async validateToken(token: string) {
    try {
      const response = await this.callGraphApi('me', token, {
        fields: 'id,name,email',
      });
      return {
        id: response.id,
        name: response.name,
      };
    } catch (error: any) {
      if (error.isTokenExpired?.()) {
        return null;
      }
      throw error;
    }
  }

  private async callGraphApi(
    endpoint: string,
    token: string,
    params: Record<string, any> = {},
    attempt = 1,
  ): Promise<any> {
    const url = new URL(`${this.graphApiUrl}/${endpoint}`);
    url.searchParams.append('access_token', token);

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });

    try {
      const response = await fetch(url.toString());
      const data = await response.json();

      if (!response.ok) {
        const error = data.error as MetaApiErrorData;
        const metaError = new MetaApiError(error?.message || 'Unknown error', error?.code);
        throw metaError;
      }

      return data;
    } catch (error: any) {
      // Retry logic for 5xx errors
      if (error instanceof TypeError || error.code >= 500) {
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
