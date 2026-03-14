import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { PrismaService } from '../prisma.service';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);

  constructor(
    @InjectQueue('meta-sync') private metaSyncQueue: Queue,
    private prisma: PrismaService,
  ) {}

  async enqueueSyncAccount(adAccountId: string) {
    try {
      const job = await this.metaSyncQueue.add(
        'sync-account',
        { adAccountId },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );

      this.logger.debug(`Enqueued sync job for account ${adAccountId}`);
      return job;
    } catch (error) {
      this.logger.error(`Failed to enqueue sync: ${error}`);
      throw error;
    }
  }

  async enqueueAllActiveAccounts() {
    const accounts = await this.prisma.ad_accounts.findMany({
      where: { status: 'active' },
      select: { id: true },
    });

    for (const account of accounts) {
      await this.enqueueSyncAccount(account.id);
    }

    return { enqueuedCount: accounts.length };
  }

  async getQueueStatus() {
    const counts = await this.metaSyncQueue.getJobCounts();
    return {
      queue: 'meta-sync',
      ...counts,
    };
  }
}
