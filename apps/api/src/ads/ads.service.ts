import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AdsService {
  constructor(private prisma: PrismaService) {}

  async findAll(orgId: string) {
    return this.prisma.ad_accounts.findMany({
      where: { org_id: orgId },
      include: {
        campaigns: {
          select: {
            id: true,
            name: true,
            status: true,
            spend: true,
            conversions: true,
            roas: true,
            cpa: true,
          },
        },
      },
    });
  }

  async findById(id: string, orgId: string) {
    const account = await this.prisma.ad_accounts.findUnique({
      where: { id },
      include: { campaigns: true },
    });

    if (!account) {
      throw new NotFoundException('Ad account not found');
    }

    if (account.org_id !== orgId) {
      throw new ForbiddenException('Not allowed to access this account');
    }

    return account;
  }

  async remove(id: string, orgId: string) {
    const account = await this.findById(id, orgId);

    await this.prisma.ad_accounts.delete({
      where: { id },
    });

    return { message: 'Ad account disconnected', account };
  }
}
