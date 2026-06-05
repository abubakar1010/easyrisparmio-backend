import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';

import appConfig from './config/app.config';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';

// Feature modules
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { BillsModule } from './modules/bills/bills.module';
import { SuppliersModule } from './modules/suppliers/suppliers.module';
import { OffersModule } from './modules/offers/offers.module';
import { CasesModule } from './modules/cases/cases.module';
import { ContractsModule } from './modules/contracts/contracts.module';
import { CommissionsModule } from './modules/commissions/commissions.module';
import { SupportModule } from './modules/support/support.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { MarketDataModule } from './modules/market-data/market-data.module';
import { FileUploadModule } from './modules/file-upload/file-upload.module';
import { ActivityLogModule } from './modules/activity-log/activity-log.module';
import { MetersModule } from './modules/meters/meters.module';
import { AlertsModule } from './modules/alerts/alerts.module';
import { ReconciliationModule } from './modules/reconciliation/reconciliation.module';
import { ReferralsModule } from './modules/referrals/referrals.module';
import { AgreementsModule } from './modules/agreements/agreements.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, jwtConfig],
      envFilePath: '.env',
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const dbUrl = configService.get<string>('database.url');
        const ssl = configService.get<boolean>('database.ssl');
        const isDev = configService.get('app.env') === 'development';

        const baseOptions = {
          type: 'postgres' as const,
          ssl: ssl ? { rejectUnauthorized: false } : false,
          autoLoadEntities: true,
          synchronize: isDev,
          logging: isDev,
        };

        if (dbUrl) {
          return { ...baseOptions, url: dbUrl };
        }

        return {
          ...baseOptions,
          host: configService.get<string>('database.host') || 'localhost',
          port: configService.get<number>('database.port') || 5432,
          username: configService.get<string>('database.username') || 'postgres',
          password: configService.get<string>('database.password') || 'postgres',
          database: configService.get<string>('database.database') || 'easyresparmio',
        };
      },
    }),

    // Rate limiting
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: 100,
      },
    ]),

    // Feature modules
    AuthModule,
    UsersModule,
    BillsModule,
    SuppliersModule,
    OffersModule,
    CasesModule,
    ContractsModule,
    CommissionsModule,
    SupportModule,
    NotificationsModule,
    DashboardModule,
    MarketDataModule,
    FileUploadModule,
    ActivityLogModule,
    MetersModule,
    AlertsModule,
    ReconciliationModule,
    ReferralsModule,
    AgreementsModule,
  ],
})
export class AppModule {}
