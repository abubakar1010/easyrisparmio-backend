import {
  Entity,
  Column,
  ManyToOne,
  OneToOne,
  JoinColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { BillType, BillStatus } from '../../../common/enums/bill.enum';
import { User } from '../../users/entities/user.entity';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { BillAnalysis } from './bill-analysis.entity';

@Entity('energy_bills')
@Index(['status'])
@Index(['userId', 'status'])
export class EnergyBill extends BaseEntity {
  @Column({ name: 'file_url', type: 'varchar', length: 500 })
  fileUrl: string;

  @Column({
    name: 'bill_type',
    type: 'enum',
    enum: BillType,
  })
  billType: BillType;

  @Column({
    type: 'enum',
    enum: BillStatus,
    default: BillStatus.UPLOADED,
  })
  status: BillStatus;

  @Column({ name: 'pod_number', type: 'varchar', length: 50, nullable: true })
  podNumber: string;

  @Column({ name: 'pdr_number', type: 'varchar', length: 50, nullable: true })
  pdrNumber: string;

  @Column({ name: 'billing_period_start', type: 'date', nullable: true })
  billingPeriodStart: Date;

  @Column({ name: 'billing_period_end', type: 'date', nullable: true })
  billingPeriodEnd: Date;

  @Column({
    name: 'total_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  totalAmount: number;

  @Column({
    name: 'consumption_kwh',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  consumptionKwh: number;

  @Column({
    name: 'consumption_smc',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  consumptionSmc: number;

  @Column({
    name: 'cost_per_unit',
    type: 'decimal',
    precision: 10,
    scale: 6,
    nullable: true,
  })
  costPerUnit: number;

  @Column({
    name: 'fixed_charges',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  fixedCharges: number;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  taxes: number;

  @Column({ name: 'raw_analysis_data', type: 'jsonb', nullable: true })
  rawAnalysisData: Record<string, any>;

  @ManyToOne(() => User, (user) => user.bills, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => Supplier, (supplier) => supplier.bills, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column({ name: 'supplier_id', type: 'uuid', nullable: true })
  supplierId: string;

  @Column({ name: 'meter_id', type: 'uuid', nullable: true })
  meterId: string | null;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;

  @ManyToOne('Meter', { nullable: true, eager: false })
  @JoinColumn({ name: 'meter_id' })
  meter: any;

  @OneToOne(() => BillAnalysis, (analysis) => analysis.bill)
  analysis: BillAnalysis;
}
