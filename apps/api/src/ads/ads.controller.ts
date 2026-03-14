import {
  Controller,
  Get,
  Delete,
  Param,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AdsService } from './ads.service';

interface User {
  userId: string;
  orgId: string;
  email: string;
  role: string;
}

@Controller('ads')
@UseGuards(JwtAuthGuard)
export class AdsController {
  constructor(private adsService: AdsService) {}

  @Get('accounts')
  async listAccounts(@CurrentUser() user: User) {
    return this.adsService.findAll(user.orgId);
  }

  @Get('accounts/:id')
  async getAccount(@Param('id') id: string, @CurrentUser() user: User) {
    return this.adsService.findById(id, user.orgId);
  }

  @Delete('accounts/:id')
  @HttpCode(200)
  async disconnectAccount(@Param('id') id: string, @CurrentUser() user: User) {
    return this.adsService.remove(id, user.orgId);
  }
}
