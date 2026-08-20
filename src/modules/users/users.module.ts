import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { BusinessProfile } from './entities/business-profile.entity';
import { UserAddress } from './entities/user-address.entity';
import { UserPreference } from './entities/user-preference.entity';
import { EnergyBill } from '../bills/entities/energy-bill.entity';
import { OtpCode } from '../auth/entities/otp-code.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { ActivityLogModule } from '../activity-log/activity-log.module';
import { LegalModule } from '../legal/legal.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, BusinessProfile, UserAddress, UserPreference, EnergyBill, OtpCode, RefreshToken]),
    ActivityLogModule,
    LegalModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
