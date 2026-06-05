import { Entity, Column, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Offer } from './offer.entity';

@Entity('offer_price_versions')
export class OfferPriceVersion extends BaseEntity {
  @Column({ name: 'offer_id', type: 'uuid' })
  offerId: string;

  @Column({ name: 'version_label', type: 'varchar', length: 20 })
  versionLabel: string;

  @Column({ name: 'price_per_kwh', type: 'decimal', precision: 10, scale: 6, nullable: true })
  pricePerKwh: number | null;

  @Column({ name: 'price_per_smc', type: 'decimal', precision: 10, scale: 6, nullable: true })
  pricePerSmc: number | null;

  @Column({ name: 'fixed_monthly_fee', type: 'decimal', precision: 10, scale: 2, nullable: true })
  fixedMonthlyFee: number | null;

  @Column({ name: 'activation_cost', type: 'decimal', precision: 10, scale: 2, nullable: true })
  activationCost: number | null;

  @Column({ name: 'valid_from', type: 'date' })
  validFrom: Date;

  @Column({ name: 'valid_until', type: 'date', nullable: true })
  validUntil: Date | null;

  @Column({ name: 'is_current', type: 'boolean', default: false })
  isCurrent: boolean;

  @Column({ name: 'price_data', type: 'jsonb', nullable: true })
  priceData: Record<string, any> | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @ManyToOne(() => Offer, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'offer_id' })
  offer: Offer;
}
