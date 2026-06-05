import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminAlert } from './entities/admin-alert.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AdminAlert])],
  exports: [TypeOrmModule],
})
export class AlertsModule {}
