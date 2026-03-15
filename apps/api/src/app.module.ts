import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { AuthModule } from './auth/auth.module';
import { MetaModule } from './meta/meta.module';
import { AdsModule } from './ads/ads.module';
import { CampaignsModule } from './campaigns/campaigns.module';
import { SyncModule } from './sync/sync.module';
import { StripeWebhookModule } from './webhooks/stripe/stripe.module';
import { JwtAuthGuard } from './auth/auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
      },
    }),
    AuthModule,
    MetaModule,
    AdsModule,
    CampaignsModule,
    SyncModule,
    StripeWebhookModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    PrismaService,
    {
      provide: 'APP_GUARD',
      useClass: JwtAuthGuard,
    },
  ],
  exports: [PrismaService, AuthModule],
})
export class AppModule {}
