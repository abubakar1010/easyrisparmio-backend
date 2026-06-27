import {
  Entity,
  Column,
  OneToMany,
  DeleteDateColumn,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Offer } from '../../offers/entities/offer.entity';
import { EnergyBill } from '../../bills/entities/energy-bill.entity';
import { SupplierStatus, Commodity } from '../../../common/enums/supplier.enum';

@Entity('suppliers')
export class Supplier extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'legal_name', type: 'varchar', length: 255, nullable: true })
  legalName: string | null;

  @Column({ name: 'tax_id', type: 'varchar', length: 50, nullable: true })
  taxId: string | null;

  @Column({ name: 'logo_url', type: 'varchar', length: 500, nullable: true })
  logoUrl: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  rating: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({
    type: 'enum',
    enum: SupplierStatus,
    default: SupplierStatus.ACTIVE,
  })
  status: SupplierStatus;

  @Column({
    type: 'enum',
    enum: Commodity,
    nullable: true,
  })
  commodity: Commodity | null;

  @Column({ name: 'contact_name', type: 'varchar', length: 255, nullable: true })
  contactName: string | null;

  @Column({ name: 'contact_email', type: 'varchar', length: 255, nullable: true })
  contactEmail: string | null;

  @Column({ name: 'contact_phone', type: 'varchar', length: 20, nullable: true })
  contactPhone: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  website: string | null;

  @Column({ name: 'street_address', type: 'varchar', length: 500, nullable: true })
  streetAddress: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ name: 'zip_code', type: 'varchar', length: 20, nullable: true })
  zipCode: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  country: string | null;

  @Column({ type: 'varchar', length: 34, nullable: true })
  iban: string | null;

  @Column({
    name: 'commission_electricity',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  commissionElectricity: number | null;

  @Column({
    name: 'commission_gas',
    type: 'decimal',
    precision: 10,
    scale: 2,
    nullable: true,
  })
  commissionGas: number | null;

  @Column({ name: 'contract_start_date', type: 'date', nullable: true })
  contractStartDate: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'supplier_code', type: 'varchar', length: 50, nullable: true, unique: true })
  supplierCode: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;

  @OneToMany(() => Offer, (offer) => offer.supplier)
  offers: Offer[];

  @OneToMany(() => EnergyBill, (bill) => bill.supplier)
  bills: EnergyBill[];
}
