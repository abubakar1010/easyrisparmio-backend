import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SupportTicket } from './support-ticket.entity';
import { User } from '../../users/entities/user.entity';

@Entity('ticket_messages')
export class TicketMessage extends BaseEntity {
  @Column({ name: 'ticket_id', type: 'uuid' })
  ticketId: string;

  @Column({ name: 'sender_id', type: 'uuid' })
  senderId: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'jsonb', nullable: true })
  attachments: string[] | null;

  @ManyToOne(() => SupportTicket, (ticket) => ticket.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'ticket_id' })
  ticket: SupportTicket;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'sender_id' })
  sender: User;
}
