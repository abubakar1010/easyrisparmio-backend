import { Entity, Column } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { UserTarget } from '../../../common/enums/offer.enum';

@Entity('faqs')
export class Faq extends BaseEntity {
  @Column({ type: 'varchar', length: 100 })
  category: string;

  @Column({ type: 'varchar', length: 500 })
  question: string;

  @Column({ type: 'text' })
  answer: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'varchar', length: 5, default: 'it' })
  locale: string;

  @Column({ name: 'target_audience', type: 'enum', enum: UserTarget, default: UserTarget.BOTH })
  targetAudience: UserTarget;
}
