import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { EnergyType, UserTarget } from '../../../common/enums/offer.enum';
import { Supplier } from '../../suppliers/entities/supplier.entity';

@Entity('commission_rules')
export class CommissionRule extends BaseEntity {
  @Column({ name: 'supplier_id', type: 'uuid' })
  supplierId: string;

  @Column({
    name: 'energy_type',
    type: 'enum',
    enum: EnergyType,
  })
  energyType: EnergyType;

  @Column({
    name: 'commission_amount',
    type: 'decimal',
    precision: 10,
    scale: 2,
  })
  commissionAmount: number;

  @Column({
    name: 'commission_percentage',
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  commissionPercentage: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'valid_from', type: 'date' })
  validFrom: Date;

  @Column({ name: 'valid_until', type: 'date', nullable: true })
  validUntil: Date;

  @Column({ name: 'offer_id', type: 'uuid', nullable: true })
  offerId: string | null;

  @Column({ type: 'enum', enum: UserTarget, default: UserTarget.BOTH })
  target: UserTarget;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @ManyToOne(() => Supplier, { eager: false })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;
}
