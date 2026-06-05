import { Entity, Column, ManyToOne, JoinColumn, Index, DeleteDateColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { UtilityType, MeterStatus } from '../../../common/enums/utility.enum';
import { User } from '../../users/entities/user.entity';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { UserAddress } from '../../users/entities/user-address.entity';

@Entity('meters')
@Index(['meterCode', 'utilityType'], { unique: true, where: '"deleted_at" IS NULL' })
export class Meter extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'utility_type', type: 'enum', enum: UtilityType })
  utilityType: UtilityType;

  @Column({ name: 'meter_code', type: 'varchar', length: 50 })
  meterCode: string;

  @Column({ name: 'supplier_id', type: 'uuid', nullable: true })
  supplierId: string | null;

  @Column({ type: 'enum', enum: MeterStatus, default: MeterStatus.ACTIVE })
  status: MeterStatus;

  @Column({ name: 'annual_consumption', type: 'decimal', precision: 12, scale: 2, nullable: true })
  annualConsumption: number | null;

  @Column({ name: 'consumption_unit', type: 'varchar', length: 20, nullable: true })
  consumptionUnit: string | null;

  @Column({ name: 'contracted_power_kw', type: 'decimal', precision: 8, scale: 2, nullable: true })
  contractedPowerKw: number | null;

  @Column({ name: 'address_id', type: 'uuid', nullable: true })
  addressId: string | null;

  @Column({ name: 'activation_date', type: 'date', nullable: true })
  activationDate: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Supplier, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @ManyToOne(() => UserAddress, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'address_id' })
  address: UserAddress;
}
