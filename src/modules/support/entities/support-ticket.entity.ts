import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import {
  TicketStatus,
  TicketPriority,
  TicketCategory,
} from '../../../common/enums/support.enum';
import { User } from '../../users/entities/user.entity';
import { TicketMessage } from './ticket-message.entity';

@Entity('support_tickets')
export class SupportTicket extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'assigned_agent_id', type: 'uuid', nullable: true })
  assignedAgentId: string;

  @Column({ type: 'varchar', length: 255 })
  subject: string;

  @Column({ type: 'enum', enum: TicketCategory, default: TicketCategory.GENERAL })
  category: TicketCategory;

  @Column({
    type: 'enum',
    enum: TicketPriority,
    default: TicketPriority.MEDIUM,
  })
  priority: TicketPriority;

  @Column({
    type: 'enum',
    enum: TicketStatus,
    default: TicketStatus.OPEN,
  })
  status: TicketStatus;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @Column({ name: 'closed_at', type: 'timestamptz', nullable: true })
  closedAt: Date | null;

  @ManyToOne(() => User, (user) => user.tickets, { eager: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'assigned_agent_id' })
  assignedAgent: User;

  @OneToMany(() => TicketMessage, (message) => message.ticket, {
    cascade: true,
  })
  messages: TicketMessage[];
}
