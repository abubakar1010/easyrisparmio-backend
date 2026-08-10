import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { SwitchCase } from './switch-case.entity';
import { User } from '../../users/entities/user.entity';

@Entity('case_notes')
export class CaseNote extends BaseEntity {
  @Column({ name: 'case_id', type: 'uuid' })
  caseId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ name: 'created_by_id', type: 'uuid' })
  createdById: string;

  @ManyToOne(() => SwitchCase, (switchCase) => switchCase.notes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'case_id' })
  switchCase: SwitchCase;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;
}
