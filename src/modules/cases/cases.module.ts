import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CasesService } from './cases.service';
import { CasesController } from './cases.controller';
import { SwitchCase } from './entities/switch-case.entity';
import { CaseDocument } from './entities/case-document.entity';
import { CaseEvent } from './entities/case-event.entity';
import { EnergyBill } from '../bills/entities/energy-bill.entity';
import { Offer } from '../offers/entities/offer.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SwitchCase,
      CaseDocument,
      CaseEvent,
      EnergyBill,
      Offer,
    ]),
  ],
  controllers: [CasesController],
  providers: [CasesService],
  exports: [CasesService],
})
export class CasesModule {}
