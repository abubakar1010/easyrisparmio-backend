import {
  Entity,
  Column,
  Index,
  ManyToOne,
  JoinColumn,
  DeleteDateColumn,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { NotificationType } from '../../../common/enums/notification.enum';
import { NotificationTemplateCategory } from '../../../common/enums/notification-template.enum';
import { User } from '../../users/entities/user.entity';

/**
 * A message an admin saved to reuse, with `{{...}}` variables resolved per
 * recipient at send time.
 *
 * Distinct from `notification-messages.ts`, which is the developer-owned
 * catalogue behind automatic events: that one is compile-time, translated, and
 * keyed to a business trigger. This one is admin-owned, single-language, and
 * only ever sent by hand from a customer's profile.
 *
 * A template is a starting point, not a binding: the composer loads it into the
 * form and the admin may edit before sending. What the customer received is
 * whatever text was rendered at that moment, stored on the notification row —
 * editing a template later never rewrites history.
 */
@Entity('notification_templates')
@Index(['category'])
@Index(['isActive'])
export class NotificationTemplate extends BaseEntity {
  /**
   * How the admin finds it in the picker.
   *
   * Uniqueness is enforced in the service, not by an index. A plain unique index
   * would let a soft-deleted template block its own name forever, and a partial
   * one (`WHERE deleted_at IS NULL`) is re-created by `synchronize` on every
   * boot — TypeORM compares the literal predicate against the form Postgres
   * normalises it to, and they differ. See notification.entity.ts.
   */
  @Column({ type: 'varchar', length: 120 })
  name: string;

  /** Subtitle in the picker — what this template is for, in one line. */
  @Column({ type: 'varchar', length: 255, nullable: true })
  description: string | null;

  @Column({
    type: 'enum',
    enum: NotificationTemplateCategory,
    default: NotificationTemplateCategory.CUSTOM,
  })
  category: NotificationTemplateCategory;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  /**
   * The type a send from this template carries. It is what drives the icon and
   * the deep link in the apps, so it belongs to the template rather than being
   * picked again on every send.
   */
  @Column({
    type: 'enum',
    enum: NotificationType,
    default: NotificationType.GENERAL,
  })
  type: NotificationType;

  /** Retires a template from the picker without losing it or its history. */
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;

  @ManyToOne(() => User, { eager: false, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @ManyToOne(() => User, { eager: false, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'updated_by' })
  editor: User;

  /**
   * The `{{...}}` tokens found in the title and body. Derived by the service on
   * every read rather than stored, so it can never fall out of step with the
   * text — the same reason StaticPage.acceptedCount is not a column.
   */
  variables?: string[];
}
