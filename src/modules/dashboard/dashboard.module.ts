import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { User } from '../users/entities/user.entity';
import { SwitchCase } from '../cases/entities/switch-case.entity';
import { Contract } from '../contracts/entities/contract.entity';
import { Commission } from '../commissions/entities/commission.entity';
import { EnergyBill } from '../bills/entities/energy-bill.entity';
import { BillAnalysis } from '../bills/entities/bill-analysis.entity';
import { AdminSettings } from './entities/admin-settings.entity';
import { AdminAlert } from '../alerts/entities/admin-alert.entity';
import { ActivityLog } from '../activity-log/entities/activity-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      SwitchCase,
      Contract,
      Commission,
      EnergyBill,
      BillAnalysis,
      AdminSettings,
      AdminAlert,
      ActivityLog,
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
