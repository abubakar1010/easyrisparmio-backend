import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import {
  CommissionStatus,
  CommissionType,
} from '../../../common/enums/commission.enum';
import { User } from '../../users/entities/user.entity';
import { SwitchCase } from '../../cases/entities/switch-case.entity';
import { Offer } from '../../offers/entities/offer.entity';
import { Supplier } from '../../suppliers/entities/supplier.entity';

@Entity('commissions')
export class Commission extends BaseEntity {
  @Column({ name: 'agent_id', type: 'uuid' })
  agentId: string;

  @Column({ name: 'case_id', type: 'uuid' })
  caseId: string;

  @Column({ name: 'offer_id', type: 'uuid' })
  offerId: string;

  @Column({ name: 'supplier_id', type: 'uuid' })
  supplierId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 3, default: 'EUR' })
  currency: string;

  @Column({
    type: 'enum',
    enum: CommissionStatus,
    default: CommissionStatus.PENDING,
  })
  status: CommissionStatus;

  @Column({
    name: 'commission_type',
    type: 'enum',
    enum: CommissionType,
    default: CommissionType.ACTIVATION,
  })
  commissionType: CommissionType;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date;

  @Column({ name: 'rule_id', type: 'uuid', nullable: true })
  ruleId: string | null;

  @Column({ name: 'approved_at', type: 'timestamptz', nullable: true })
  approvedAt: Date | null;

  @Column({ name: 'approved_by_id', type: 'uuid', nullable: true })
  approvedById: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @ManyToOne('CommissionRule', { nullable: true, eager: false })
  @JoinColumn({ name: 'rule_id' })
  rule: any;

  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'approved_by_id' })
  approvedBy: User;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'agent_id' })
  agent: User;

  @ManyToOne(() => SwitchCase, { eager: false })
  @JoinColumn({ name: 'case_id' })
  case: SwitchCase;

  @ManyToOne(() => Offer, { eager: false })
  @JoinColumn({ name: 'offer_id' })
  offer: Offer;

  @ManyToOne(() => Supplier, { eager: false })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;
}
