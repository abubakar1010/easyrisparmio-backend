import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgreementsController } from './agreements.controller';
import { AgreementsService } from './agreements.service';
import { Agreement } from './entities/agreement.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Agreement])],
  controllers: [AgreementsController],
  providers: [AgreementsService],
  exports: [AgreementsService, TypeOrmModule],
})
export class AgreementsModule {}
