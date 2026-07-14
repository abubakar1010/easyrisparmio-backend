import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';
import { Offer } from './entities/offer.entity';
import { OfferPriceVersion } from './entities/offer-price-version.entity';
import { SentOffer } from './entities/sent-offer.entity';
import { BillsModule } from '../bills/bills.module';

@Module({
  imports: [TypeOrmModule.forFeature([Offer, OfferPriceVersion, SentOffer]), BillsModule],
  controllers: [OffersController],
  providers: [OffersService],
  exports: [OffersService, TypeOrmModule],
})
export class OffersModule {}
