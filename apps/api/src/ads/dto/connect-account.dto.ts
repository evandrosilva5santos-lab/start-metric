import { z } from 'zod';

/**
 * Schema para validação de conexão de conta Meta Ads
 */
export const connectAccountSchema = z.object({
  platform: z.enum(['meta', 'google', 'tiktok'], {
    message: 'Platform must be one of: meta, google, tiktok',
  }),
  externalId: z.string({
    message: 'External ID is required',
  }),
  name: z
    .string({
      message: 'Account name is required',
    })
    .min(1, 'Account name cannot be empty'),
  accessToken: z
    .string({
      message: 'Access token is required',
    })
    .min(10, 'Access token is too short'),
  tokenExpiresAt: z.string().datetime().optional(),
  currency: z.string().optional(),
  timezone: z.string().optional(),
});

export type ConnectAccountDto = z.infer<typeof connectAccountSchema>;

/**
 * Schema para validação de atualização de token
 */
export const updateTokenSchema = z.object({
  accessToken: z
    .string({
      message: 'Access token is required',
    })
    .min(10, 'Access token is too short'),
  tokenExpiresAt: z.string().datetime().optional(),
});

export type UpdateTokenDto = z.infer<typeof updateTokenSchema>;

/**
 * Schema para resposta de conta conectada
 */
export const accountResponseSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().uuid(),
  externalId: z.string(),
  platform: z.string(),
  name: z.string(),
  currency: z.string().nullable(),
  timezone: z.string().nullable(),
  status: z.string(),
  connectedAt: z.date(),
  lastSyncedAt: z.date().nullable(),
});

export type AccountResponse = z.infer<typeof accountResponseSchema>;
