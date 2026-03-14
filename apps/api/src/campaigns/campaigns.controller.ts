import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CampaignsService } from './campaigns.service';
import { IsNumber, IsEnum } from 'class-validator';

class UpdateStatusDto {
  @IsEnum(['ACTIVE', 'PAUSED', 'DELETED', 'ARCHIVED'])
  status: 'ACTIVE' | 'PAUSED' | 'DELETED' | 'ARCHIVED';
}

class UpdateBudgetDto {
  @IsNumber()
  dailyBudget: number;
}

interface User {
  userId: string;
  orgId: string;
  email: string;
  role: string;
}

@Controller('campaigns')
@UseGuards(JwtAuthGuard)
export class CampaignsController {
  constructor(private campaignsService: CampaignsService) {}

  @Get()
  async listCampaigns(
    @CurrentUser() user: User,
    @Query('adAccountId') adAccountId?: string,
  ) {
    return this.campaignsService.findAll(user.orgId, adAccountId);
  }

  @Get(':id')
  async getCampaign(@Param('id') id: string, @CurrentUser() user: User) {
    return this.campaignsService.findById(id, user.orgId);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
    @CurrentUser() user: User,
  ) {
    // TODO: Get token from request context when auth is fully integrated
    const token = process.env.META_APP_SECRET || '';
    return this.campaignsService.updateStatus(
      id,
      user.orgId,
      dto.status,
      token,
    );
  }

  @Patch(':id/budget')
  async updateBudget(
    @Param('id') id: string,
    @Body() dto: UpdateBudgetDto,
    @CurrentUser() user: User,
  ) {
    // TODO: Get token from request context when auth is fully integrated
    const token = process.env.META_APP_SECRET || '';
    return this.campaignsService.updateBudget(
      id,
      user.orgId,
      dto.dailyBudget,
      token,
    );
  }
}
