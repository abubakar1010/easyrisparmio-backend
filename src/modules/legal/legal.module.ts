import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { LegalService } from './legal.service';
import { LegalController } from './legal.controller';
import { UserLegalAcceptance } from './entities/user-legal-acceptance.entity';
import { StaticPage } from '../static-pages/entities/static-page.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserLegalAcceptance, StaticPage])],
  controllers: [LegalController],
  providers: [LegalService],
  exports: [LegalService],
})
export class LegalModule {}
