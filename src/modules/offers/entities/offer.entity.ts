import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import {
  EnergyType,
  MarketType,
  OfferPaymentMethod,
  UserTarget,
} from '../../../common/enums/offer.enum';
import { OfferStatus } from '../../../common/enums/offer-status.enum';
import { Supplier } from '../../suppliers/entities/supplier.entity';

/** Longest fixed term an offer may carry; beyond it clients that read days as `days / 30` drift. */
export const MAX_CONTRACT_DURATION_MONTHS = 60;

/**
 * Days equivalent of a contract term, using an average month so 12/24/36 months
 * land on 365/730/1095. Null (indefinite) becomes 0, which every client already
 * renders as "no fixed term".
 */
export function contractDurationMonthsToDays(months: number | null): number {
  if (months == null || months <= 0) return 0;
  return Math.round((months * 365) / 12);
}

@Entity('offers')
@Index(['supplierId', 'energyType'])
export class Offer extends BaseEntity {
  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', default: '' })
  compensation: string;

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
    name: 'spread',
    type: 'decimal',
    precision: 10,
    scale: 6,
    nullable: true,
  })
  spread: number;

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

  /**
   * How long the offer's conditions stay locked for a customer once their
   * supply is activated — 12, 24, 36 months — or null when the contract has no
   * fixed term (indefinite). Nothing to do with `validFrom`/`validUntil`, which
   * only say when the offer can be sold.
   */
  @Column({ name: 'contract_duration_months', type: 'int', nullable: true })
  contractDurationMonths: number | null;

  /**
   * `contractDurationMonths` expressed in days, kept for the clients that still
   * read it (the mobile app, sent-offer snapshots). Always derived through
   * `contractDurationMonthsToDays`, never written on its own; 0 means indefinite.
   */
  @Column({ name: 'contract_duration_days', type: 'int' })
  contractDurationDays: number;

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

  @Column({ name: 'economic_conditions_url', type: 'varchar', length: 500, nullable: true })
  economicConditionsUrl: string | null;

  @Column({
    type: 'enum',
    enum: UserTarget,
    default: UserTarget.BOTH,
  })
  target: UserTarget;

  // Defaulted rather than nullable so the column backfills cleanly on existing
  // rows — this project has no migrations, the schema comes from synchronize.
  @Column({
    name: 'payment_method',
    type: 'enum',
    enum: OfferPaymentMethod,
    default: OfferPaymentMethod.BOTH,
  })
  paymentMethod: OfferPaymentMethod;

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
