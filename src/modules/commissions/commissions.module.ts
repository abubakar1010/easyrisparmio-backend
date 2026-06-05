import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommissionsService } from './commissions.service';
import { CommissionsController } from './commissions.controller';
import { Commission } from './entities/commission.entity';
import { CommissionRule } from './entities/commission-rule.entity';
import { CommissionTier } from './entities/commission-tier.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Commission, CommissionRule, CommissionTier])],
  controllers: [CommissionsController],
  providers: [CommissionsService],
  exports: [CommissionsService],
})
export class CommissionsModule {}
