import { Entity, Column, OneToMany } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SupportTicket } from './support-ticket.entity';

@Entity('support_topics')
export class SupportTopic extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'varchar', length: 50, nullable: true })
  icon: string | null;

  @OneToMany(() => SupportTicket, (ticket) => ticket.topic)
  tickets: SupportTicket[];
}
