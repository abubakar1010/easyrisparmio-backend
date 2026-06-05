import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Meter } from './entities/meter.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Meter])],
  exports: [TypeOrmModule],
})
export class MetersModule {}
