import {
  Entity,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from './user.entity';

@Entity('business_profiles')
export class BusinessProfile extends BaseEntity {
  @Column({ name: 'company_name', type: 'varchar', length: 255 })
  companyName: string;

  @Column({ name: 'partita_iva', type: 'varchar', length: 11, unique: true })
  partitaIva: string;

  @Column({ name: 'legal_representative', type: 'varchar', length: 255, nullable: true })
  legalRepresentative: string;

  @Column({ name: 'company_type', type: 'varchar', length: 100, nullable: true })
  companyType: string;

  /**
   * Position the account holder occupies in the company, as picked on the
   * mobile personal-data screen or by an admin. Free text rather than an enum:
   * the picker offers a shortlist plus "Other", and the list is expected to
   * grow.
   */
  @Column({ name: 'job_role', type: 'varchar', length: 100, nullable: true })
  jobRole: string | null;

  @Column({ name: 'ateco_code', type: 'varchar', length: 10, nullable: true })
  atecoCode: string;

  /**
   * Posta Elettronica Certificata — the address that is legally a company's
   * point of contact in Italy.
   *
   * This column existed once before and was dropped, because it was collected
   * and then never read by anything. It is back with a consumer: a business
   * case that has no explicit invoice address falls back to the PEC rather than
   * the sign-in email (see `CasesService.resolveInvoiceEmail`), which is where
   * a supplier expects to send a company's invoices.
   */
  @Column({ name: 'pec_email', type: 'varchar', length: 255, nullable: true })
  pecEmail: string | null;

  /**
   * Codice Destinatario — the seven-character SDI address electronic invoices
   * are routed to. The other half of Italian B2B invoicing: a supplier needs
   * either this or the PEC to deliver an invoice at all, so it travels to them
   * on the case alongside the company's VAT number.
   *
   * Seven characters exactly when set. `0000000` is the placeholder the
   * Agenzia delle Entrate defines for a recipient who has no SDI channel and is
   * reached by PEC instead, so it is a legitimate stored value rather than a
   * blank to reject.
   */
  @Column({ name: 'sdi_code', type: 'varchar', length: 7, nullable: true })
  sdiCode: string | null;

  @Column({ name: 'employee_count', type: 'int', nullable: true })
  employeeCount: number | null;

  @Column({ name: 'annual_revenue_range', type: 'varchar', length: 50, nullable: true })
  annualRevenueRange: string | null;

  @OneToOne(() => User, (user) => user.businessProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;
}
