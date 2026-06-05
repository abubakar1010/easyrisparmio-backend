import { Entity, Column, ManyToOne, JoinColumn, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';
import { CaseEventType } from '../../../common/enums/case-event.enum';
import { CaseStatus } from '../../../common/enums/case.enum';
import { SwitchCase } from './switch-case.entity';
import { User } from '../../users/entities/user.entity';

@Entity('case_events')
@Index(['caseId', 'createdAt'])
export class CaseEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'case_id', type: 'uuid' })
  caseId: string;

  @Column({ name: 'event_type', type: 'enum', enum: CaseEventType })
  eventType: CaseEventType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'old_status', type: 'enum', enum: CaseStatus, nullable: true })
  oldStatus: CaseStatus | null;

  @Column({ name: 'new_status', type: 'enum', enum: CaseStatus, nullable: true })
  newStatus: CaseStatus | null;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId: string | null;

  @Column({ name: 'actor_label', type: 'varchar', length: 100, nullable: true })
  actorLabel: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => SwitchCase, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'case_id' })
  switchCase: SwitchCase;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_id' })
  actor: User;
}
