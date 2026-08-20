import { Entity, Column, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { LegalAudience } from '../../../common/enums/legal.enum';

@Entity('static_pages')
@Index('UQ_static_page_slug_locale', ['slug', 'locale'], { unique: true })
export class StaticPage extends BaseEntity {
  @Column({ type: 'varchar', length: 50 })
  slug: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'varchar', length: 5, default: 'it' })
  locale: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  /**
   * Dotted document version ("2.1"). Bumping it is what makes every user who
   * accepted an older version get asked again — see LegalService. Editing the
   * text without touching this is a typo fix, not a new agreement.
   */
  @Column({ type: 'varchar', length: 20, default: '1.0' })
  version: string;

  /**
   * Marks the page as an agreement the user has to actively accept, rather
   * than informational content like About Us.
   */
  @Column({ name: 'requires_acceptance', type: 'boolean', default: false })
  requiresAcceptance: boolean;

  /**
   * Which accounts the document binds. Business terms never interrupt a
   * personal user, and vice versa.
   */
  @Column({
    type: 'enum',
    enum: LegalAudience,
    default: LegalAudience.ALL,
  })
  audience: LegalAudience;

  /** When the current version went live. Set automatically on a version bump. */
  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  /**
   * Plain-language "what changed" shown at the top of the re-acceptance
   * prompt. Users are far likelier to actually read a three-line summary than
   * a re-run of the whole document.
   */
  @Column({ name: 'change_summary', type: 'text', nullable: true })
  changeSummary: string | null;

  /**
   * Populated by the admin listing only — how many users have accepted this
   * document at its current version.
   */
  acceptedCount?: number;
}
