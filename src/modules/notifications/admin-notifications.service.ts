import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../../common/enums/role.enum';
import { UserStatus } from '../../common/enums/user.enum';
import { NotificationType } from '../../common/enums/notification.enum';
import { NotificationsService } from './notifications.service';
import { AdminMessageKey } from './notification-messages';

export interface NotifyAdminsInput {
  /** Copy for the event, resolved per-admin against their language preference. */
  messageKey: AdminMessageKey;
  /** Drives the colour and the type filter on the dashboard. */
  type: NotificationType;
  /** Interpolation arguments for the message body, in declaration order. */
  bodyParams?: unknown[];
  /** Entity ids the dashboard uses to deep-link (billId, caseId, ticketId...). */
  data?: Record<string, unknown>;
  /**
   * Who triggered the event. When this is an admin they are left out of the
   * recipients, so admins are never notified about their own actions.
   */
  actorId?: string;
  /** Display name of the actor, recorded on the payload for the audit trail. */
  actorName?: string;
}

/**
 * Fans a platform event out to every admin as an in-app notification (plus a
 * push to any device they have registered, web dashboard included).
 *
 * Admins are addressed as ordinary recipients — one `Notification` row each,
 * with `user_id` set to the admin. That is what makes the existing bell,
 * unread count and `GET /notifications/admin?direction=received` work without
 * any change to the read path.
 *
 * `sentBy` is deliberately left NULL. The dashboard classifies a row as
 * "sent by me" with `!!sentBy && sentBy !== userId`, so writing the triggering
 * customer's id there would file every admin notification under the wrong tab.
 * The actor goes on `data.actorId` / `data.actorName` instead.
 *
 * Every failure is swallowed and logged: a notification must never break the
 * business transaction that produced it.
 */
@Injectable()
export class AdminNotificationsService {
  private readonly logger = new Logger(AdminNotificationsService.name);

  /** Admins change rarely but this runs on every platform event. */
  private static readonly CACHE_TTL_MS = 60_000;
  private cachedAdminIds: string[] | null = null;
  private cacheExpiresAt = 0;

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async notifyAdmins(input: NotifyAdminsInput): Promise<void> {
    try {
      const recipients = await this.resolveRecipients(input.actorId);
      if (!recipients.length) {
        return;
      }

      await this.notificationsService.sendNotification({
        userIds: recipients,
        messageKey: input.messageKey,
        bodyParams: (input.bodyParams ?? []) as any[],
        type: input.type,
        data: {
          event: input.messageKey,
          ...(input.actorId ? { actorId: input.actorId } : {}),
          ...(input.actorName ? { actorName: input.actorName } : {}),
          ...(input.data ?? {}),
        },
      });
    } catch (error) {
      this.logger.warn(
        `Admin notification "${input.messageKey}" failed: ${
          (error as Error)?.message ?? error
        }`,
      );
    }
  }

  /**
   * Display name for a user id, for admin-facing copy. Falls back to the email,
   * then to a generic label, so a notification body is never left blank.
   *
   * Lives here rather than in each producer because this service already holds
   * the only `User` repository the notification path needs.
   */
  async describeUser(userId?: string | null): Promise<string> {
    if (!userId) return 'Sistema';
    try {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        select: { id: true, firstName: true, lastName: true, email: true },
      });
      if (!user) return 'Utente sconosciuto';
      return (
        `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email
      );
    } catch {
      return 'Utente sconosciuto';
    }
  }

  /**
   * Forget the memoised admin list. Call this whenever an admin is created,
   * suspended or deleted so the next event addresses the right people.
   */
  invalidateAdminCache(): void {
    this.cachedAdminIds = null;
    this.cacheExpiresAt = 0;
  }

  private async resolveRecipients(actorId?: string): Promise<string[]> {
    const adminIds = await this.getAdminIds();
    return actorId ? adminIds.filter((id) => id !== actorId) : adminIds;
  }

  private async getAdminIds(): Promise<string[]> {
    const now = Date.now();
    if (this.cachedAdminIds && now < this.cacheExpiresAt) {
      return this.cachedAdminIds;
    }

    const admins = await this.userRepository.find({
      where: { role: UserRole.ADMIN, status: UserStatus.ACTIVE },
      select: { id: true },
    });

    this.cachedAdminIds = admins.map((admin) => admin.id);
    this.cacheExpiresAt = now + AdminNotificationsService.CACHE_TTL_MS;
    return this.cachedAdminIds;
  }
}
