import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { BillsController } from './bills.controller';
import { BillsService } from './bills.service';
import { EnergyBill } from './entities/energy-bill.entity';
import { BillAnalysis } from './entities/bill-analysis.entity';
import { Offer } from '../offers/entities/offer.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { SentOffer } from '../offers/entities/sent-offer.entity';
import { SwitchCase } from '../cases/entities/switch-case.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { ConfigModule } from '@nestjs/config';
import { VisionOcrService } from './ocr/vision-ocr.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([EnergyBill, BillAnalysis, Offer, Supplier, SentOffer, SwitchCase]),
    NotificationsModule,
    ConfigModule,
  ],
  controllers: [BillsController],
  providers: [BillsService, VisionOcrService],
  exports: [BillsService, TypeOrmModule],
})
export class BillsModule implements OnModuleInit {
  onModuleInit() {
    mkdirSync(join(process.cwd(), 'uploads', 'bills'), { recursive: true });
  }
}
