import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  OneToOne,
  JoinColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { CaseStatus, CasePriority } from '../../../common/enums/case.enum';
import { CaseType } from '../../../common/enums/case-type.enum';
import { User } from '../../users/entities/user.entity';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { EnergyBill } from '../../bills/entities/energy-bill.entity';
import { Offer } from '../../offers/entities/offer.entity';
import { CaseDocument } from './case-document.entity';
import { Contract } from '../../contracts/entities/contract.entity';

@Entity('switch_cases')
@Index(['status'])
@Index(['status', 'userId'])
export class SwitchCase extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'bill_id', type: 'uuid' })
  billId: string;

  @Column({ name: 'selected_offer_id', type: 'uuid' })
  selectedOfferId: string;

  @Column({ name: 'assigned_agent_id', type: 'uuid', nullable: true })
  assignedAgentId: string;

  @Column({
    type: 'enum',
    enum: CaseStatus,
    default: CaseStatus.NEW,
  })
  status: CaseStatus;

  @Column({
    type: 'enum',
    enum: CasePriority,
    default: CasePriority.MEDIUM,
  })
  priority: CasePriority;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'internal_notes', type: 'text', nullable: true })
  internalNotes: string;

  @Column({ name: 'case_number', type: 'varchar', length: 20, unique: true, nullable: true })
  caseNumber: string | null;

  @Column({ name: 'case_type', type: 'enum', enum: CaseType, default: CaseType.SWITCH })
  caseType: CaseType;

  @Column({ name: 'sla_deadline', type: 'timestamptz', nullable: true })
  slaDeadline: Date | null;

  @Column({ name: 'sla_days_total', type: 'int', nullable: true })
  slaDaysTotal: number | null;

  @Column({ name: 'estimated_annual_value', type: 'decimal', precision: 12, scale: 2, nullable: true })
  estimatedAnnualValue: number | null;

  @Column({ name: 'from_supplier_id', type: 'uuid', nullable: true })
  fromSupplierId: string | null;

  @Column({ name: 'to_supplier_id', type: 'uuid', nullable: true })
  toSupplierId: string | null;

  @Column({ name: 'meter_id', type: 'uuid', nullable: true })
  meterId: string | null;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'assigned_agent_id' })
  assignedAgent: User;

  @ManyToOne(() => EnergyBill, { eager: false })
  @JoinColumn({ name: 'bill_id' })
  bill: EnergyBill;

  @ManyToOne(() => Offer, { eager: false })
  @JoinColumn({ name: 'selected_offer_id' })
  selectedOffer: Offer;

  @OneToMany(() => CaseDocument, (doc) => doc.switchCase)
  documents: CaseDocument[];

  @ManyToOne(() => Supplier, { nullable: true, eager: false })
  @JoinColumn({ name: 'from_supplier_id' })
  fromSupplier: Supplier;

  @ManyToOne(() => Supplier, { nullable: true, eager: false })
  @JoinColumn({ name: 'to_supplier_id' })
  toSupplier: Supplier;

  @OneToOne(() => Contract, (contract) => contract.switchCase)
  contract: Contract;
}
