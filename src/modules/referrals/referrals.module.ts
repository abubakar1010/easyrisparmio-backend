import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Referral } from './entities/referral.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Referral])],
  exports: [TypeOrmModule],
})
export class ReferralsModule {}
