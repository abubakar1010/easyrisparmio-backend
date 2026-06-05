import { Entity, Column, OneToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { PaymentMethod, InvoiceDelivery, LanguagePref } from '../../../common/enums/payment.enum';
import { User } from './user.entity';

@Entity('user_preferences')
export class UserPreference extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId: string;

  @Column({ name: 'payment_method', type: 'enum', enum: PaymentMethod, nullable: true, default: PaymentMethod.RID_BANCARIO })
  paymentMethod: PaymentMethod | null;

  @Column({ name: 'invoice_delivery', type: 'enum', enum: InvoiceDelivery, nullable: true, default: InvoiceDelivery.DIGITAL })
  invoiceDelivery: InvoiceDelivery | null;

  @Column({ type: 'enum', enum: LanguagePref, default: LanguagePref.ITALIANO })
  language: LanguagePref;

  @Column({ name: 'contact_preference', type: 'varchar', length: 20, nullable: true, default: 'email' })
  contactPreference: string | null;

  @Column({ name: 'marketing_consent', type: 'boolean', default: false })
  marketingConsent: boolean;

  @Column({ name: 'gdpr_consent_at', type: 'timestamptz', nullable: true })
  gdprConsentAt: Date | null;

  @Column({ type: 'varchar', length: 34, nullable: true })
  iban: string | null;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
