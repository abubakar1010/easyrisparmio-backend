import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupportService } from './support.service';
import { SupportController } from './support.controller';
import { SupportTicket } from './entities/support-ticket.entity';
import { TicketMessage } from './entities/ticket-message.entity';
import { Faq } from './entities/faq.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SupportTicket, TicketMessage, Faq])],
  controllers: [SupportController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}
