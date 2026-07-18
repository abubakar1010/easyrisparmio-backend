import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContractsService } from './contracts.service';
import { ContractsController } from './contracts.controller';
import { Contract } from './entities/contract.entity';
import { SwitchCase } from '../cases/entities/switch-case.entity';
import { CaseEvent } from '../cases/entities/case-event.entity';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contract, SwitchCase, CaseEvent]),
    NotificationsModule,
  ],
  controllers: [ContractsController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
