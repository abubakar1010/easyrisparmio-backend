import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { NotificationType } from '../../../common/enums/notification.enum';
import { User } from '../../users/entities/user.entity';

/**
 * One row per recipient. Admins are ordinary recipients — see
 * AdminNotificationsService for why they are not a separate table.
 *
 * The unique index on (user_id, dedupe_key) is what makes a notification
 * exactly-once per event per person. Every automatic trigger passes a key
 * derived from the entity it is about (`bill:<id>:activated`), so re-saving a
 * status, moving a case back and forth, or running a cron twice can never
 * produce a second copy. Manually composed messages pass no key at all: the
 * column is NULL and Postgres allows unlimited NULLs in a unique index, so an
 * admin can deliberately send the same text twice.
 */
// Not a partial index. Postgres treats NULLs as distinct in a unique index, so
// manually composed messages — which carry no key — never collide with each
// other, and `WHERE dedupe_key IS NOT NULL` would buy only a smaller index at
// the cost of `synchronize` re-creating it on every boot (TypeORM compares the
// literal predicate against the one Postgres normalises it to, and they differ).
@Entity('notifications')
@Index('uq_notifications_user_dedupe', ['userId', 'dedupeKey'], { unique: true })
export class Notification extends BaseEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({
    type: 'enum',
    enum: NotificationType,
    default: NotificationType.GENERAL,
  })
  type: NotificationType;

  @Column({ type: 'jsonb', nullable: true })
  data: Record<string, any> | null;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead: boolean;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @Column({ name: 'sent_by', type: 'uuid', nullable: true })
  sentBy: string | null;

  /**
   * The template this message was composed from, or NULL for free text.
   *
   * Deliberately a bare column with no foreign key: this table is append-only
   * history and has to survive any template deletion policy, where an FK would
   * either block the delete or null the audit trail. It is also deliberately not
   * a key inside `data` — that object is forwarded verbatim into the FCM payload
   * and is the apps' deep-link contract, which provenance has no business
   * growing.
   */
  @Column({ name: 'template_id', type: 'uuid', nullable: true })
  templateId: string | null;

  /**
   * Identifies the business event this notification reports, so the same event
   * is never announced twice. NULL for manually composed messages.
   */
  @Column({ name: 'dedupe_key', type: 'varchar', length: 160, nullable: true })
  dedupeKey: string | null;

  @ManyToOne(() => User, (user) => user.notifications, { eager: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'sent_by' })
  sender: User;

  /**
   * Name of the template this was composed from, filled by the customer-history
   * read only. Not a column: the notification stores the text it actually sent,
   * and looking the name up keeps a renamed template from rewriting history it
   * has no business touching.
   */
  templateName?: string | null;
}
