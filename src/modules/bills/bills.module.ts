import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillsController } from './bills.controller';
import { BillsService } from './bills.service';
import { EnergyBill } from './entities/energy-bill.entity';
import { BillAnalysis } from './entities/bill-analysis.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EnergyBill, BillAnalysis])],
  controllers: [BillsController],
  providers: [BillsService],
  exports: [BillsService, TypeOrmModule],
})
export class BillsModule {}
