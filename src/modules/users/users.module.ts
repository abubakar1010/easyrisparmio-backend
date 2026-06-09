import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { BusinessProfile } from './entities/business-profile.entity';
import { UserAddress } from './entities/user-address.entity';
import { UserPreference } from './entities/user-preference.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User, BusinessProfile, UserAddress, UserPreference])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
