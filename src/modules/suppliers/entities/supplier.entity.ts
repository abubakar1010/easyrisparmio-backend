import {
  Entity,
  Column,
  OneToMany,
  DeleteDateColumn,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Offer } from '../../offers/entities/offer.entity';
import { EnergyBill } from '../../bills/entities/energy-bill.entity';

@Entity('suppliers')
export class Supplier extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'logo_url', type: 'varchar', length: 500, nullable: true })
  logoUrl: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 0 })
  rating: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'contact_email', type: 'varchar', length: 255, nullable: true })
  contactEmail: string;

  @Column({ name: 'contact_phone', type: 'varchar', length: 20, nullable: true })
  contactPhone: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  website: string;

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
