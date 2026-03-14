import { Controller, Post, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SyncService } from './sync.service';

interface User {
  userId: string;
  orgId: string;
  email: string;
  role: string;
}

@Controller('sync')
@UseGuards(JwtAuthGuard)
export class SyncController {
  constructor(private syncService: SyncService) {}

  @Post('account/:id')
  async syncAccount(
    @Param('id') adAccountId: string,
    @CurrentUser() user: User,
  ) {
    // TODO: Validate that user owns this account
    const job = await this.syncService.enqueueSyncAccount(adAccountId);
    return { message: 'Sync job enqueued', jobId: job.id };
  }

  @Post('all')
  async syncAllAccounts(@CurrentUser() user: User) {
    // TODO: Sync only accounts owned by user's org
    return this.syncService.enqueueAllActiveAccounts();
  }

  @Get('queue-status')
  async getQueueStatus() {
    return this.syncService.getQueueStatus();
  }
}
