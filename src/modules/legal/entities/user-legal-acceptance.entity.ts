import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { User } from '../../users/entities/user.entity';
import { LegalAcceptanceSource } from '../../../common/enums/legal.enum';

/**
 * One row per (user, document, version) — an append-only consent ledger.
 *
 * Storing the accepted *version* rather than a `termsAccepted: true` flag is
 * the whole point: publishing 2.1 over a user who accepted 2.0 leaves a
 * verifiable record of exactly what they agreed to and when, and lets the app
 * ask them again without losing the earlier consent.
 */
@Entity('user_legal_acceptances')
@Index('UQ_legal_acceptance_user_slug_version', ['userId', 'slug', 'version'], {
  unique: true,
})
@Index(['slug', 'version'])
export class UserLegalAcceptance extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  @Index()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  /** Document slug, e.g. `terms-conditions`. Not a FK: pages can be re-created. */
  @Column({ type: 'varchar', length: 50 })
  slug: string;

  /** The exact version string the user agreed to, e.g. `2.1`. */
  @Column({ type: 'varchar', length: 20 })
  version: string;

  /** Locale of the document the user actually read. */
  @Column({ type: 'varchar', length: 5, default: 'it' })
  locale: string;

  @Column({ name: 'accepted_at', type: 'timestamptz' })
  acceptedAt: Date;

  @Column({
    type: 'enum',
    enum: LegalAcceptanceSource,
    default: LegalAcceptanceSource.REACCEPTANCE,
  })
  source: LegalAcceptanceSource;

  /** Kept for consent audits; nullable because server-side records have neither. */
  @Column({ name: 'ip_address', type: 'varchar', length: 64, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'user_agent', type: 'varchar', length: 512, nullable: true })
  userAgent: string | null;
}
