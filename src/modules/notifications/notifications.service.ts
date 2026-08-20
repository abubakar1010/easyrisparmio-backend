import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { Notification } from './entities/notification.entity';
import { PushToken } from './entities/push-token.entity';
import { UserPreference } from '../users/entities/user-preference.entity';
import { SendNotificationDto } from './dto/send-notification.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { QueryAdminNotificationsDto } from './dto/query-admin-notifications.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { Platform } from '../../common/enums/notification.enum';
import { LanguagePref } from '../../common/enums/language.enum';
import { getNotificationText, MessageKey } from './notification-messages';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(PushToken)
    private readonly pushTokenRepository: Repository<PushToken>,
    @InjectRepository(UserPreference)
    private readonly preferenceRepository: Repository<UserPreference>,
    private readonly configService: ConfigService,
  ) {}

  private async getUserLanguage(userId: string): Promise<'it' | 'en'> {
    try {
      const pref = await this.preferenceRepository.findOne({
        where: { userId },
      });
      return pref?.language === LanguagePref.ENGLISH ? 'en' : 'it';
    } catch {
      return 'it';
    }
  }

  async sendNotification(
    dto: SendNotificationDto,
    sentBy?: string,
  ): Promise<Notification | Notification[]> {
    const userIds = dto.userIds || (dto.userId ? [dto.userId] : []);

    // Resolve i18n text per user when messageKey is provided
    const perUserText: Map<string, { title: string; body: string }> = new Map();

    if (dto.messageKey) {
      for (const uid of userIds) {
        const lang = await this.getUserLanguage(uid);
        const resolved = getNotificationText(
          dto.messageKey as MessageKey,
          lang,
          dto.bodyParams || [],
        );
        // If the caller also provided a raw body (e.g. admin-composed message),
        // use it as the body but take the translated title
        perUserText.set(uid, {
          title: resolved.title,
          body: dto.body || resolved.body,
        });
      }
    }

    const notifications = userIds.map((uid) => {
      const text = perUserText.get(uid);
      return this.notificationRepository.create({
        userId: uid,
        title: text?.title || dto.title || '',
        body: text?.body || dto.body || '',
        type: dto.type,
        data: dto.data || null,
        sentBy: sentBy || null,
      });
    });

    const saved = await this.notificationRepository.save(notifications);

    // Fire-and-forget FCM push delivery (per-user text for i18n)
    try {
      const fallbackText = { title: dto.title || '', body: dto.body || '' };
      await this.deliverPush(
        userIds,
        (uid) => perUserText.get(uid) || fallbackText,
        dto.data,
      );
    } catch (error) {
      this.logger.warn(`FCM push delivery failed: ${error?.message || error}`);
    }

    return saved.length === 1 ? saved[0] : saved;
  }

  async getUserNotifications(
    userId: string,
    query: QueryNotificationsDto,
  ): Promise<PaginatedResponseDto<Notification>> {
    const qb = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.userId = :userId', { userId });

    if (query.type) {
      qb.andWhere('notification.type = :type', { type: query.type });
    }

    if (query.isRead !== undefined) {
      qb.andWhere('notification.isRead = :isRead', { isRead: query.isRead });
    }

    qb.orderBy('notification.createdAt', 'DESC');
    qb.skip(query.skip).take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResponseDto(data, total, query.page, query.limit);
  }

  async markAsRead(notificationId: string, userId: string): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    notification.isRead = true;
    notification.readAt = new Date();
    return this.notificationRepository.save(notification);
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepository.update(
      { userId, isRead: false },
      { isRead: true, readAt: new Date() },
    );
  }

  async getAdminNotifications(
    adminId: string,
    query: QueryAdminNotificationsDto,
  ): Promise<PaginatedResponseDto<Notification>> {
    const qb = this.notificationRepository
      .createQueryBuilder('notification')
      .leftJoinAndSelect('notification.user', 'user');

    const direction = query.direction || 'all';

    if (direction === 'sent') {
      qb.where('notification.sentBy = :adminId', { adminId });
    } else if (direction === 'received') {
      qb.where('notification.userId = :adminId', { adminId });
    } else {
      qb.where(
        '(notification.sentBy = :adminId OR notification.userId = :adminId)',
        { adminId },
      );
    }

    if (query.type) {
      qb.andWhere('notification.type = :type', { type: query.type });
    }

    qb.orderBy('notification.createdAt', 'DESC');
    qb.skip(query.skip).take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResponseDto(data, total, query.page, query.limit);
  }

  async getNotificationById(
    notificationId: string,
    adminId: string,
  ): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId },
      relations: ['user'],
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    // Auto-mark as read if this is a received notification for the admin
    if (notification.userId === adminId && !notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date();
      await this.notificationRepository.save(notification);
    }

    return notification;
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.notificationRepository.count({
      where: { userId, isRead: false },
    });
  }

  async registerPushToken(
    userId: string,
    token: string,
    platform: Platform,
  ): Promise<PushToken> {
    const existing = await this.pushTokenRepository.findOne({
      where: { token },
    });

    if (existing) {
      existing.userId = userId;
      existing.platform = platform;
      existing.isActive = true;
      return this.pushTokenRepository.save(existing);
    }

    const pushToken = this.pushTokenRepository.create({
      userId,
      token,
      platform,
      isActive: true,
    });

    return this.pushTokenRepository.save(pushToken);
  }

  async removePushToken(token: string): Promise<void> {
    const pushToken = await this.pushTokenRepository.findOne({
      where: { token },
    });

    if (!pushToken) {
      throw new NotFoundException('Push token not found');
    }

    pushToken.isActive = false;
    await this.pushTokenRepository.save(pushToken);
  }

  /** FCM rejects non-string `data` values, so everything is serialised. */
  private buildDataPayload(
    data?: Record<string, any>,
  ): Record<string, string> | undefined {
    if (!data) return undefined;
    return Object.fromEntries(
      Object.entries(data).map(([k, v]) => [
        k,
        typeof v === 'string' ? v : JSON.stringify(v),
      ]),
    );
  }

  /**
   * Where clicking a desktop notification lands.
   *
   * Deliberately always the notification centre rather than the entity: the
   * entity-to-route mapping lives in the dashboard, and duplicating it here
   * would leave two copies to drift apart. The dashboard deep-links onward.
   */
  private webPushLink(): string {
    const raw = this.configService.get<string>('app.dashboardUrl') || '';
    const base = raw.endsWith('/') ? raw.slice(0, -1) : raw;
    return `${base}/notifications`;
  }

  /**
   * Delivers a push to every active device of every listed user.
   *
   * `textFor` is resolved per token, so one code path serves both a single
   * shared title/body and a per-recipient translation.
   */
  private async deliverPush(
    userIds: string[],
    textFor: (userId: string) => { title: string; body: string },
    data?: Record<string, any>,
  ): Promise<void> {
    const apps = getApps();
    if (!apps.length) return;

    const tokens = await this.pushTokenRepository.find({
      where: { userId: In(userIds), isActive: true },
    });

    if (!tokens.length) return;

    const dataPayload = this.buildDataPayload(data);
    const messaging = getMessaging(apps[0]);

    const messages = tokens.map((pt) => {
      const text = textFor(pt.userId);
      return {
        token: pt.token,
        notification: { title: text.title, body: text.body },
        data: dataPayload,
        // Browsers ignore FCM's click_action; a web target needs the link in
        // the webpush block instead.
        ...(pt.platform === Platform.WEB
          ? { webpush: { fcmOptions: { link: this.webPushLink() } } }
          : {}),
      };
    });

    const result = await messaging.sendEach(messages);

    // Drop tokens FCM reports as permanently gone (uninstalled app, revoked
    // browser permission) so they stop costing a send every time.
    const invalidTokenIds = result.responses.reduce<string[]>((ids, r, i) => {
      if (
        !r.success &&
        r.error?.code === 'messaging/registration-token-not-registered'
      ) {
        ids.push(tokens[i].id);
      }
      return ids;
    }, []);

    if (invalidTokenIds.length) {
      await this.pushTokenRepository.update(invalidTokenIds, {
        isActive: false,
      });
      this.logger.log(
        `Deactivated ${invalidTokenIds.length} invalid push token(s)`,
      );
    }
  }
}
