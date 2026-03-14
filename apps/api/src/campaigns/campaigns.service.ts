import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { MetaService } from '../meta/meta.service';

@Injectable()
export class CampaignsService {
  constructor(
    private prisma: PrismaService,
    private metaService: MetaService,
  ) {}

  async findAll(orgId: string, adAccountId?: string) {
    const where: any = { org_id: orgId };
    if (adAccountId) {
      where.ad_account_id = adAccountId;
    }

    return this.prisma.campaigns.findMany({
      where,
      include: {
        ad_accounts: true,
        daily_metrics: {
          orderBy: { date: 'desc' },
          take: 7,
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async findById(id: string, orgId: string) {
    const campaign = await this.prisma.campaigns.findUnique({
      where: { id },
      include: {
        ad_accounts: true,
        daily_metrics: {
          orderBy: { date: 'desc' },
          take: 30,
        },
      },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.org_id !== orgId) {
      throw new ForbiddenException('Not allowed to access this campaign');
    }

    return campaign;
  }

  async updateStatus(
    id: string,
    orgId: string,
    status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED',
    token: string,
  ) {
    const campaign = await this.findById(id, orgId);

    // Call Meta API to update status
    try {
      await this.metaService.fetchCampaigns(campaign.ad_account_id, token);
      // In real implementation, would call Meta API to update
    } catch (error: any) {
      throw new BadRequestException(`Failed to update campaign: ${error.message}`);
    }

    return this.prisma.campaigns.update({
      where: { id },
      data: { status },
    });
  }

  async updateBudget(
    id: string,
    orgId: string,
    dailyBudget: number,
    token: string,
  ) {
    const campaign = await this.findById(id, orgId);

    if (dailyBudget < 0) {
      throw new BadRequestException('Daily budget must be positive');
    }

    // Call Meta API to update budget
    try {
      await this.metaService.fetchCampaigns(campaign.ad_account_id, token);
      // In real implementation, would call Meta API to update
    } catch (error: any) {
      throw new BadRequestException(`Failed to update budget: ${error.message}`);
    }

    return this.prisma.campaigns.update({
      where: { id },
      data: { daily_budget: dailyBudget },
    });
  }
}
