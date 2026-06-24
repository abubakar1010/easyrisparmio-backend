import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillsController } from './bills.controller';
import { BillsService } from './bills.service';
import { EnergyBill } from './entities/energy-bill.entity';
import { BillAnalysis } from './entities/bill-analysis.entity';
import { Offer } from '../offers/entities/offer.entity';
import { AdminSettings } from '../dashboard/entities/admin-settings.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([EnergyBill, BillAnalysis, Offer, AdminSettings]),
    NotificationsModule,
  ],
  controllers: [BillsController],
  providers: [BillsService],
  exports: [BillsService, TypeOrmModule],
})
export class BillsModule {}
