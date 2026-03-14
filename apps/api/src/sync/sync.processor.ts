import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { PrismaService } from '../prisma.service';
import { MetaService } from '../meta/meta.service';

@Processor('meta-sync')
export class SyncProcessor {
  private readonly logger = new Logger(SyncProcessor.name);

  constructor(
    private prisma: PrismaService,
    private metaService: MetaService,
  ) {}

  @Process('sync-account')
  async handleSyncAccount(job: Job<{ adAccountId: string }>) {
    const { adAccountId } = job.data;

    try {
      this.logger.debug(`Processing sync job for account ${adAccountId}`);

      // TODO: Decrypt token from ad_accounts table via Supabase RPC
      // For now, use placeholder
      const account = await this.prisma.ad_accounts.findUnique({
        where: { id: adAccountId },
      });

      if (!account) {
        throw new Error(`Account ${adAccountId} not found`);
      }

      // TODO: Decrypt token
      const token = account.token_encrypted; // This would be decrypted in real implementation

      // Fetch campaigns and insights from Meta API
      // const campaigns = await this.metaService.fetchCampaigns(adAccountId, token);
      // const insights = await this.metaService.fetchInsights(adAccountId, token);

      // Update last_synced_at
      await this.prisma.ad_accounts.update({
        where: { id: adAccountId },
        data: { last_synced_at: new Date() },
      });

      this.logger.debug(`Successfully synced account ${adAccountId}`);
      return { success: true, adAccountId };
    } catch (error: any) {
      this.logger.error(`Failed to sync account ${adAccountId}: ${error.message}`);
      throw error;
    }
  }
}
