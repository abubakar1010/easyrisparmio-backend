import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractsService } from './contracts.service';
import { ContractsController } from './contracts.controller';
import { Contract } from './entities/contract.entity';
import { SwitchCase } from '../cases/entities/switch-case.entity';
import { CaseEvent } from '../cases/entities/case-event.entity';
import { SentOffer } from '../offers/entities/sent-offer.entity';
import { EnergyBill } from '../bills/entities/energy-bill.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { ActivityLogModule } from '../activity-log/activity-log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contract, SwitchCase, CaseEvent, SentOffer, EnergyBill]),
    NotificationsModule,
    ActivityLogModule,
  ],
  controllers: [ContractsController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
