import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Agreement } from './entities/agreement.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Agreement])],
  exports: [TypeOrmModule],
})
export class AgreementsModule {}
