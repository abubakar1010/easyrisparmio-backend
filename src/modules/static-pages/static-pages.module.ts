import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaticPagesService } from './static-pages.service';
import { StaticPagesController } from './static-pages.controller';
import { StaticPage } from './entities/static-page.entity';
import { LegalModule } from '../legal/legal.module';

@Module({
  imports: [TypeOrmModule.forFeature([StaticPage]), LegalModule],
  controllers: [StaticPagesController],
  providers: [StaticPagesService],
  exports: [StaticPagesService],
})
export class StaticPagesModule {}
