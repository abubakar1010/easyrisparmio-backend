import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { EnergyType, MarketType, UserTarget } from '../../../common/enums/offer.enum';
import { OfferStatus } from '../../../common/enums/offer-status.enum';
import { Supplier } from '../../suppliers/entities/supplier.entity';

@Entity('offers')
@Index(['supplierId', 'energyType'])
export class Offer extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({
    name: 'energy_type',
    type: 'enum',
    enum: EnergyType,
  })
  energyType: EnergyType;

  @Column({
    name: 'market_type',
    type: 'enum',
    enum: MarketType,
  })
  marketType: MarketType;

  @Column({
    name: 'price_per_kwh',
    type: 'decimal',
    precision: 10,
    scale: 6,
    nullable: true,
  })
  pricePerKwh: number;

  @Column({
    name: 'price_per_smc',
    type: 'decimal',
    precision: 10,
    scale: 6,
    nullable: true,
  })
  pricePerSmc: number;

  @Column({
    name: 'fixed_monthly_fee',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  fixedMonthlyFee: number;

  @Column({
    name: 'activation_cost',
    type: 'decimal',
    precision: 10,
    scale: 2,
    default: 0,
  })
  activationCost: number;

  @Column({ name: 'contract_duration_months', type: 'int' })
  contractDurationMonths: number;

  @Column({ name: 'is_green_energy', type: 'boolean', default: false })
  isGreenEnergy: boolean;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'valid_from', type: 'date' })
  validFrom: Date;

  @Column({ name: 'valid_until', type: 'date', nullable: true })
  validUntil: Date;

  @Column({ name: 'terms_url', type: 'varchar', length: 500, nullable: true })
  termsUrl: string;

  @Column({
    type: 'enum',
    enum: UserTarget,
    default: UserTarget.BOTH,
  })
  target: UserTarget;

  @Column({ type: 'jsonb', nullable: true })
  highlights: string[];

  @Column({ name: 'name_i18n', type: 'jsonb', nullable: true })
  nameI18n: Record<string, string> | null;

  @Column({ name: 'description_i18n', type: 'jsonb', nullable: true })
  descriptionI18n: Record<string, string> | null;

  @Column({ name: 'highlights_i18n', type: 'jsonb', nullable: true })
  highlightsI18n: Record<string, string[]> | null;

  @Column({ name: 'offer_code', type: 'varchar', length: 50, nullable: true })
  offerCode: string | null;

  @Column({ type: 'enum', enum: OfferStatus, default: OfferStatus.DRAFT, name: 'offer_status' })
  offerStatus: OfferStatus;

  @Column({ type: 'int', default: 1 })
  version: number;

  @Column({ name: 'parent_offer_id', type: 'uuid', nullable: true })
  parentOfferId: string | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;

  @ManyToOne(() => Offer, { nullable: true })
  @JoinColumn({ name: 'parent_offer_id' })
  parentOffer: Offer;

  @ManyToOne(() => Supplier, (supplier) => supplier.offers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'supplier_id' })
  supplier: Supplier;

  @Column({ name: 'supplier_id', type: 'uuid' })
  supplierId: string;
}
