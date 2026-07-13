import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { BillsController } from './bills.controller';
import { BillsService } from './bills.service';
import { EnergyBill } from './entities/energy-bill.entity';
import { BillAnalysis } from './entities/bill-analysis.entity';
import { Offer } from '../offers/entities/offer.entity';
import { AdminSettings } from '../dashboard/entities/admin-settings.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { OcrService } from './ocr/ocr.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([EnergyBill, BillAnalysis, Offer, AdminSettings, Supplier]),
    NotificationsModule,
  ],
  controllers: [BillsController],
  providers: [BillsService, OcrService],
  exports: [BillsService, TypeOrmModule],
})
export class BillsModule implements OnModuleInit {
  onModuleInit() {
    mkdirSync(join(process.cwd(), 'uploads', 'bills'), { recursive: true });
  }
}
