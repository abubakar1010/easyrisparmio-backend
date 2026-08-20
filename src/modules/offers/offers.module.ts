import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';
import { Offer } from './entities/offer.entity';
import { OfferPriceVersion } from './entities/offer-price-version.entity';
import { SentOffer } from './entities/sent-offer.entity';
import { SwitchCase } from '../cases/entities/switch-case.entity';
import { Supplier } from '../suppliers/entities/supplier.entity';
import { BillsModule } from '../bills/bills.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([Offer, OfferPriceVersion, SentOffer, SwitchCase, Supplier]), BillsModule, ActivityLogModule, NotificationsModule],
  controllers: [OffersController],
  providers: [OffersService],
  exports: [OffersService, TypeOrmModule],
})
export class OffersModule {}
