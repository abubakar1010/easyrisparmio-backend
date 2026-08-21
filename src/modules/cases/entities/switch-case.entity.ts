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
import { CaseStatus, CasePriority } from '../../../common/enums/case.enum';
import { CaseType } from '../../../common/enums/case-type.enum';
import { PaymentMethod, InvoiceDelivery } from '../../../common/enums/payment.enum';
import { User } from '../../users/entities/user.entity';
import { Supplier } from '../../suppliers/entities/supplier.entity';
import { EnergyBill } from '../../bills/entities/energy-bill.entity';
import { Offer } from '../../offers/entities/offer.entity';
import { CaseDocument } from './case-document.entity';
import { CaseEvent } from './case-event.entity';

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

  // ── Activation ──
  // Contract signing happens outside the application. Once it is done the admin
  // moves the case to "In Attivazione" and supplies both dates by hand; nothing
  // here is ever derived from a signing event, because we never see one.

  /** When the new supply goes live. Planned while the switch is running. */
  @Column({ name: 'activation_date', type: 'date', nullable: true })
  activationDate: Date | null;

  /** When the new supply contract expires. */
  @Column({ name: 'expiry_date', type: 'date', nullable: true })
  expiryDate: Date | null;

  /** When the admin handed the contract over for signing. */
  @Column({ name: 'contract_sent_at', type: 'timestamptz', nullable: true })
  contractSentAt: Date | null;

  // ── Addresses ──
  // Supply, residential and shipping addresses all carry the same five fields
  // (street, civic number, city, CAP, province) so downstream consumers read
  // every address the same way.

  // Where the energy is delivered — taken from the bill and confirmed by the user.
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

  // Where the customer resides. Always populated; the flag records whether the
  // user declared it identical to the supply address.
  @Column({ name: 'residential_same_as_supply', type: 'boolean', default: false })
  residentialSameAsSupply: boolean;

  @Column({ name: 'residential_street', type: 'varchar', length: 255, nullable: true })
  residentialStreet: string | null;

  @Column({ name: 'residential_street_number', type: 'varchar', length: 20, nullable: true })
  residentialStreetNumber: string | null;

  @Column({ name: 'residential_city', type: 'varchar', length: 100, nullable: true })
  residentialCity: string | null;

  @Column({ name: 'residential_postal_code', type: 'varchar', length: 10, nullable: true })
  residentialPostalCode: string | null;

  @Column({ name: 'residential_province', type: 'varchar', length: 100, nullable: true })
  residentialProvince: string | null;

  // Where paper invoices are posted — only set when invoiceDelivery is PAPER.
  @Column({ name: 'shipping_same_as_supply', type: 'boolean', default: false })
  shippingSameAsSupply: boolean;

  @Column({ name: 'shipping_street', type: 'varchar', length: 255, nullable: true })
  shippingStreet: string | null;

  @Column({ name: 'shipping_street_number', type: 'varchar', length: 20, nullable: true })
  shippingStreetNumber: string | null;

  @Column({ name: 'shipping_city', type: 'varchar', length: 100, nullable: true })
  shippingCity: string | null;

  @Column({ name: 'shipping_postal_code', type: 'varchar', length: 10, nullable: true })
  shippingPostalCode: string | null;

  @Column({ name: 'shipping_province', type: 'varchar', length: 100, nullable: true })
  shippingProvince: string | null;

  @Column({ name: 'payment_method', type: 'enum', enum: PaymentMethod, nullable: true })
  paymentMethod: PaymentMethod | null;

  @Column({ name: 'invoice_delivery', type: 'enum', enum: InvoiceDelivery, nullable: true })
  invoiceDelivery: InvoiceDelivery | null;

  // Where digital invoices are sent. Defaults to the account email, but the
  // customer can route them elsewhere on the request form.
  @Column({ name: 'invoice_email', type: 'varchar', length: 255, nullable: true })
  invoiceEmail: string | null;

  @Column({ type: 'varchar', length: 34, nullable: true })
  iban: string | null;

  // Whether the account the direct debit is taken from belongs to the contract
  // holder. Stored rather than inferred from the holder fields being blank —
  // a third-party mandate needs that holder's own signature, and null here
  // means the question predates the case, not that the answer was "no".
  @Column({ name: 'iban_same_as_contract', type: 'boolean', nullable: true })
  ibanSameAsContract: boolean | null;

  @Column({ name: 'iban_holder_first_name', type: 'varchar', length: 100, nullable: true })
  ibanHolderFirstName: string | null;

  @Column({ name: 'iban_holder_last_name', type: 'varchar', length: 100, nullable: true })
  ibanHolderLastName: string | null;

  @Column({ name: 'iban_holder_tax_code', type: 'varchar', length: 16, nullable: true })
  ibanHolderTaxCode: string | null;

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

  @OneToMany(() => CaseEvent, (event) => event.switchCase)
  events: CaseEvent[];
}
