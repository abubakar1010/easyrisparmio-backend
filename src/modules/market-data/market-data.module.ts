import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MarketDataService } from './market-data.service';
import { MarketDataController } from './market-data.controller';
import { MarketIndex } from './entities/market-index.entity';

@Module({
  imports: [TypeOrmModule.forFeature([MarketIndex])],
  controllers: [MarketDataController],
  providers: [MarketDataService],
  exports: [MarketDataService],
})
export class MarketDataModule {}
