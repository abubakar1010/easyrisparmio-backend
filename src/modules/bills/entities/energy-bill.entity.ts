import {
  Entity,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { BillType, BillStatus, BillSource } from '../../../common/enums/bill.enum';
import { User } from '../../users/entities/user.entity';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { BillFile } from './bill-file.entity';
import { BillNote } from './bill-note.entity';
import { BillVerification } from './bill-verification.entity';
import { SwitchCase } from '../../cases/entities/switch-case.entity';

@Entity('energy_bills')
@Index(['status'])
@Index(['userId', 'status'])
export class EnergyBill extends BaseEntity {
  @Column({ name: 'file_url', type: 'varchar', length: 500, nullable: true })
  fileUrl: string | null;

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

  @Column({
    type: 'enum',
    enum: BillSource,
    default: BillSource.UPLOAD,
  })
  source: BillSource;

  @Column({ name: 'pod_number', type: 'varchar', length: 50, nullable: true })
  podNumber: string | null;

  @Column({ name: 'pdr_number', type: 'varchar', length: 50, nullable: true })
  pdrNumber: string | null;

  @Column({ name: 'billing_period_start', type: 'date', nullable: true })
  billingPeriodStart: Date | null;

  @Column({ name: 'billing_period_end', type: 'date', nullable: true })
  billingPeriodEnd: Date | null;

  @Column({
    name: 'total_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  totalAmount: number | null;

  @Column({
    name: 'consumption_kwh',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  consumptionKwh: number | null;

  @Column({
    name: 'consumption_smc',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  consumptionSmc: number | null;

  @Column({
    name: 'cost_per_unit',
    type: 'decimal',
    precision: 10,
    scale: 6,
    nullable: true,
  })
  costPerUnit: number | null;

  @Column({
    name: 'fixed_charges',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  fixedCharges: number | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  taxes: number | null;

  // ── Supply address ──
  // Where the energy is delivered, split into the same five fields a case
  // stores (street, civic number, city, CAP, province) so the address the OCR
  // reads and the address the customer confirms have one shape end to end.

  @Column({ name: 'supply_street', type: 'varchar', length: 255, nullable: true })
  supplyStreet: string | null;

  @Column({ name: 'supply_street_number', type: 'varchar', length: 20, nullable: true })
  supplyStreetNumber: string | null;

  @Column({ name: 'supply_city', type: 'varchar', length: 100, nullable: true })
  supplyCity: string | null;

  @Column({ name: 'supply_postal_code', type: 'varchar', length: 10, nullable: true })
  supplyPostalCode: string | null;

  @Column({ name: 'supply_province', type: 'varchar', length: 100, nullable: true })
  supplyProvince: string | null;

  /**
   * The five fields above rendered as one line, kept in step with them on every
   * write. Everything that only displays the address reads this, so the split
   * stays invisible to the utilities list, the client drawer and the mobile
   * bill card. On bills stored before the columns existed it is the only copy
   * of the address there is.
   */
  @Column({ name: 'supply_address', type: 'varchar', length: 500, nullable: true })
  supplyAddress: string | null;

  @Column({ name: 'codice_fiscale', type: 'varchar', length: 16, nullable: true })
  codiceFiscale: string | null;

  @Column({ name: 'partita_iva', type: 'varchar', length: 11, nullable: true })
  partitaIva: string | null;

  @Column({ name: 'contract_number', type: 'varchar', length: 50, nullable: true })
  contractNumber: string | null;

  @Column({ name: 'meter_number', type: 'varchar', length: 50, nullable: true })
  meterNumber: string | null;

  @Column({ name: 'customer_name', type: 'varchar', length: 200, nullable: true })
  customerName: string | null;

  @Column({ name: 'supplier_name', type: 'varchar', length: 200, nullable: true })
  supplierName: string | null;

  @Column({ name: 'raw_analysis_data', type: 'jsonb', nullable: true })
  rawAnalysisData: Record<string, any> | null;

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

  @OneToMany(() => BillFile, (f) => f.bill, { cascade: true })
  files: BillFile[];

  @OneToMany(() => BillVerification, (v) => v.bill)
  verifications: BillVerification[];

  @OneToMany(() => BillNote, (n) => n.bill)
  notes: BillNote[];

  @OneToMany(() => SwitchCase, (sc) => sc.bill)
  switchCases: SwitchCase[];
}
