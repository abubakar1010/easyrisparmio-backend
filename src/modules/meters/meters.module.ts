import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MetersController } from './meters.controller';
import { MetersService } from './meters.service';
import { Meter } from './entities/meter.entity';
import { SwitchCase } from '../cases/entities/switch-case.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Meter, SwitchCase])],
  controllers: [MetersController],
  providers: [MetersService],
  exports: [MetersService, TypeOrmModule],
})
export class MetersModule {}
