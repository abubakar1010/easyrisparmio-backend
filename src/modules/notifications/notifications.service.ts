import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { Notification } from './entities/notification.entity';
import { NotificationTemplate } from './entities/notification-template.entity';
import { SwitchCase } from '../cases/entities/switch-case.entity';
import { PushToken } from './entities/push-token.entity';
import { User } from '../users/entities/user.entity';
import { UserPreference } from '../users/entities/user-preference.entity';
import { SendNotificationDto } from './dto/send-notification.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { QueryAdminNotificationsDto } from './dto/query-admin-notifications.dto';
import { QueryCustomerNotificationsDto } from './dto/query-customer-notifications.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import {
  NotificationType,
  Platform,
} from '../../common/enums/notification.enum';
import { LanguagePref } from '../../common/enums/language.enum';
import { getNotificationText, MessageKey } from './notification-messages';
import {
  TemplateRenderContext,
  renderTemplateText,
  usesCaseScopedVariables,
} from './notification-variables';

/**
 * What the service accepts internally, which is wider than what the API does.
 *
 * `dedupeKey` is deliberately absent from `SendNotificationDto`: the request
 * pipeline runs with `forbidNonWhitelisted`, so an admin calling
 * `POST /notifications/send` cannot forge a key and silently suppress a real
 * notification. Only the in-process triggers set it.
 *
 * `userIds` is absent for the same reason. The DTO is locked to one recipient —
 * an admin composes to a single customer, never to a group. The one caller that
 * writes many rows at once is `notifyAdmins`, telling every admin about a
 * platform event, and that is a system alert rather than an admin-composed
 * message.
 */
export type SendNotificationInput = Omit<SendNotificationDto, 'userId'> & {
  userId?: string;
  /** Internal event fan-out only — see above. Never part of a request body. */
  userIds?: string[];
  dedupeKey?: string;
};

/** The user fields `{{...}}` placeholders can address. */
type PlaceholderUser = Pick<User, 'id' | 'firstName' | 'lastName' | 'email'>;

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  /** Latches the missing-Firebase warning so it is logged once per process. */
  private warnedNoFirebase = false;

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(PushToken)
    private readonly pushTokenRepository: Repository<PushToken>,
    @InjectRepository(UserPreference)
    private readonly preferenceRepository: Repository<UserPreference>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(SwitchCase)
    private readonly caseRepository: Repository<SwitchCase>,
    @InjectRepository(NotificationTemplate)
    private readonly templateRepository: Repository<NotificationTemplate>,
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
    dto: SendNotificationInput,
    sentBy?: string,
  ): Promise<Notification | Notification[]> {
    const userIds = dto.userIds || (dto.userId ? [dto.userId] : []);
    if (!userIds.length) {
      return [];
    }

    const { textFor, unresolved } = await this.resolveTextPerUser(dto, userIds);

    // Refuse rather than deliver a half-written sentence. A case variable has no
    // sensible fallback — a customer who has not chosen an offer has no provider
    // — and an unknown token is a typo the admin needs to see. Thrown before
    // anything is written, so a rejected send leaves no row and pushes nothing.
    if (unresolved.length) {
      throw new BadRequestException(
        `Cannot resolve ${unresolved
          .map((key) => `{{${key}}}`)
          .join(', ')} for this recipient`,
      );
    }

    const rows = userIds.map((uid) =>
      this.notificationRepository.create({
        userId: uid,
        title: textFor(uid).title,
        body: textFor(uid).body,
        type: dto.type,
        data: dto.data || null,
        sentBy: sentBy || null,
        templateId: dto.templateId || null,
        dedupeKey: dto.dedupeKey || null,
      }),
    );

    const saved = dto.dedupeKey
      ? await this.insertIgnoringDuplicates(rows)
      : await this.notificationRepository.save(rows);

    // Every recipient had already been told about this event. Nothing was
    // written, so nothing should be pushed either.
    if (!saved.length) {
      return [];
    }

    try {
      await this.deliverPush(
        saved.map((notification) => notification.userId),
        textFor,
        dto.data,
        dto.type,
      );
    } catch (error) {
      this.logger.warn(`FCM push delivery failed: ${error?.message || error}`);
    }

    return saved.length === 1 ? saved[0] : saved;
  }

  /**
   * Resolves the title and body each recipient should see, and reports every
   * variable that could not be filled.
   *
   * Three things vary per user: the language a `messageKey` renders in, the
   * `{{...}}` variables an admin may have written by hand, and the case those
   * variables read from. All are resolved up front so the same text serves the
   * stored row and the push.
   *
   * Substitution itself lives in notification-variables.ts, which is also what
   * the preview endpoint calls — one renderer, so the preview an admin approves
   * cannot disagree with what the customer receives.
   */
  private async resolveTextPerUser(
    dto: SendNotificationInput,
    userIds: string[],
  ): Promise<{
    textFor: (userId: string) => { title: string; body: string };
    unresolved: string[];
  }> {
    const resolved = new Map<string, { title: string; body: string }>();
    const fallback = { title: dto.title || '', body: dto.body || '' };

    // A language lookup is a query per recipient, so only pay for it when
    // something actually reads the language: a translated `messageKey`, or a
    // `{{utility_type}}` that has to come out as "Luce" rather than "Electricity".
    const needsLanguage =
      Boolean(dto.messageKey) ||
      fallback.title.includes('{{') ||
      fallback.body.includes('{{');

    const langFor = new Map<string, 'it' | 'en'>();
    if (needsLanguage) {
      for (const uid of userIds) {
        langFor.set(uid, await this.getUserLanguage(uid));
      }
    }

    if (dto.messageKey) {
      for (const uid of userIds) {
        const text = getNotificationText(
          dto.messageKey as MessageKey,
          langFor.get(uid) || 'it',
          dto.bodyParams || [],
        );
        // A caller may supply a raw body alongside a key — an admin's own
        // words under a translated heading. The key still owns the title.
        resolved.set(uid, {
          title: text.title,
          body: dto.body || text.body,
        });
      }
    } else {
      for (const uid of userIds) {
        resolved.set(uid, { ...fallback });
      }
    }

    const usesPlaceholders = [...resolved.values()].some(
      (text) => text.title.includes('{{') || text.body.includes('{{'),
    );

    if (!usesPlaceholders) {
      return {
        textFor: (userId: string) => resolved.get(userId) || fallback,
        unresolved: [],
      };
    }

    const users = await this.loadPlaceholderUsers(userIds);

    // Only pay for the join across cases, offers and suppliers when the text
    // actually addresses one.
    const needsCase = [...resolved.values()].some(
      (text) =>
        usesCaseScopedVariables(text.title) ||
        usesCaseScopedVariables(text.body),
    );
    const cases = needsCase
      ? await this.loadCaseContexts(userIds, dto.caseId)
      : new Map<string, TemplateRenderContext>();

    const unresolved = new Set<string>();

    for (const [uid, text] of resolved) {
      const context: TemplateRenderContext = {
        ...(cases.get(uid) || {}),
        user: users.get(uid) || null,
      };
      const locale = langFor.get(uid) || 'it';

      const title = renderTemplateText(text.title, context, locale);
      const body = renderTemplateText(text.body, context, locale);

      title.unresolved.forEach((key) => unresolved.add(key));
      body.unresolved.forEach((key) => unresolved.add(key));

      resolved.set(uid, { title: title.text, body: body.text });
    }

    return {
      textFor: (userId: string) => resolved.get(userId) || fallback,
      unresolved: [...unresolved],
    };
  }

  /**
   * The full variable context for one customer, plus the language they read in.
   *
   * Public so the preview endpoint renders against exactly what the send path
   * would resolve, using the same two queries. Keeping the loaders private and
   * exposing only this keeps the preview from drifting into a second
   * implementation of the lookup.
   */
  async buildRenderContext(
    userId: string,
    caseId?: string,
  ): Promise<{ context: TemplateRenderContext; locale: 'it' | 'en' }> {
    const [users, cases, locale] = await Promise.all([
      this.loadPlaceholderUsers([userId]),
      this.loadCaseContexts([userId], caseId),
      this.getUserLanguage(userId),
    ]);

    const user = users.get(userId);

    // Without this a preview for an unknown id renders every user variable as
    // an empty string — they fall back through to the email, which is empty
    // too, and a user-scoped variable is never reported as unresolved. The
    // admin would be shown a blank message rather than an error.
    if (!user) {
      throw new NotFoundException('Customer not found');
    }

    return {
      context: {
        ...(cases.get(userId) || {}),
        user,
      },
      locale,
    };
  }

  private async loadPlaceholderUsers(
    userIds: string[],
  ): Promise<Map<string, PlaceholderUser>> {
    try {
      const users = await this.userRepository.find({
        where: { id: In(userIds) },
        select: { id: true, firstName: true, lastName: true, email: true },
      });
      return new Map(users.map((user) => [user.id, user]));
    } catch (error) {
      this.logger.warn(
        `Could not load recipients for placeholder substitution: ${
          error?.message || error
        }`,
      );
      return new Map();
    }
  }

  /**
   * The case each recipient's `{{provider}}`, `{{offer_name}}` and
   * `{{utility_type}}` read from — one query for the whole batch.
   *
   * Mirrors MetersService.findUserActivatedServices, including its choice of
   * `bill.billType` over `offer.energyType`: an offer covering both supplies is
   * `dual`, which would name a supply the customer never asked for.
   *
   * Unlike that method this does *not* filter by LIVE_UTILITY_CASE_STATUSES.
   * That set begins at activation, and the templates this feeds — "documents to
   * re-upload", "your case has moved on" — are precisely for a case that has not
   * reached it yet.
   *
   * An explicit `caseId` is keyed by the case's own owner, so passing another
   * customer's case leaves this recipient with no context and the send is
   * refused, rather than quietly rendering someone else's supplier.
   */
  private async loadCaseContexts(
    userIds: string[],
    caseId?: string,
  ): Promise<Map<string, TemplateRenderContext>> {
    const byUser = new Map<string, TemplateRenderContext>();

    try {
      const qb = this.caseRepository
        .createQueryBuilder('sc')
        .leftJoin('sc.selectedOffer', 'offer')
        .addSelect(['offer.id', 'offer.name'])
        .leftJoin('offer.supplier', 'supplier')
        .addSelect(['supplier.id', 'supplier.name'])
        .leftJoin('sc.bill', 'bill')
        .addSelect(['bill.id', 'bill.billType'])
        .where('sc.deletedAt IS NULL');

      if (caseId) {
        qb.andWhere('sc.id = :caseId', { caseId });
      } else {
        qb.andWhere('sc.userId IN (:...userIds)', { userIds });
      }

      const cases = await qb.orderBy('sc.createdAt', 'DESC').getMany();

      for (const switchCase of cases) {
        // Newest first, so the first row seen for a user is the one to use.
        if (byUser.has(switchCase.userId)) continue;

        byUser.set(switchCase.userId, {
          caseId: switchCase.id,
          caseNumber: switchCase.caseNumber,
          provider: switchCase.selectedOffer?.supplier?.name || null,
          offerName: switchCase.selectedOffer?.name || null,
          utilityType: switchCase.bill?.billType || null,
        });
      }
    } catch (error) {
      this.logger.warn(
        `Could not load case context for notification variables: ${
          error?.message || error
        }`,
      );
    }

    return byUser;
  }

  /**
   * Writes the rows that do not already exist, and reports which those were.
   *
   * `ON CONFLICT DO NOTHING` against the unique `(user_id, dedupe_key)` index
   * is what makes a trigger exactly-once. Checking first and inserting after
   * would leave a race between two admins clicking at the same moment, and a
   * plain insert would raise a unique violation that aborts the surrounding
   * business transaction — a notification must never do that.
   */
  private async insertIgnoringDuplicates(
    rows: Notification[],
  ): Promise<Notification[]> {
    const result = await this.notificationRepository
      .createQueryBuilder()
      .insert()
      .into(Notification)
      .values(rows)
      .orIgnore()
      .returning('*')
      .execute();

    const inserted: any[] = Array.isArray(result?.raw) ? result.raw : [];

    return inserted.map((row) =>
      this.notificationRepository.create({
        id: row.id,
        userId: row.user_id,
        title: row.title,
        body: row.body,
        type: row.type,
        data: row.data ?? null,
        isRead: row.is_read ?? false,
        readAt: row.read_at ?? null,
        sentBy: row.sent_by ?? null,
        templateId: row.template_id ?? null,
        dedupeKey: row.dedupe_key ?? null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }),
    );
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
      // Explicit columns rather than leftJoinAndSelect. `passwordHash` is
      // `select: false` so it can no longer escape this way, but the whole
      // entity still carries a phone number and a codice fiscale that a
      // notification list has no reason to publish.
      .leftJoin('notification.user', 'user')
      .addSelect(['user.id', 'user.firstName', 'user.lastName', 'user.email']);

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
    // `relations: ['user']` would select every User column. Name the four the
    // dashboard actually renders instead.
    const notification = await this.notificationRepository
      .createQueryBuilder('notification')
      .leftJoin('notification.user', 'user')
      .addSelect(['user.id', 'user.firstName', 'user.lastName', 'user.email'])
      .where('notification.id = :notificationId', { notificationId })
      .getOne();

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

  /**
   * Everything ever sent to one customer, for the history on their profile.
   *
   * Deliberately not a variation of getAdminNotifications: that one is the
   * *admin's* own inbox and outbox, scoped to whoever is logged in. This is
   * scoped to the recipient regardless of who sent it, which is what "the
   * customer's notification history" means — an operator needs to see what a
   * colleague sent, and what the platform sent automatically.
   *
   * Rows with no sender were raised by a trigger rather than a person. Clients
   * render those as "Sistema"; a blank would read as missing data.
   */
  async getCustomerNotificationHistory(
    userId: string,
    query: QueryCustomerNotificationsDto,
  ): Promise<PaginatedResponseDto<Notification>> {
    const qb = this.notificationRepository
      .createQueryBuilder('notification')
      .leftJoin('notification.sender', 'sender')
      .addSelect([
        'sender.id',
        'sender.firstName',
        'sender.lastName',
        'sender.email',
      ])
      .where('notification.userId = :userId', { userId });

    if (query.type) {
      qb.andWhere('notification.type = :type', { type: query.type });
    }

    if (query.isRead !== undefined) {
      qb.andWhere('notification.isRead = :isRead', { isRead: query.isRead });
    }

    if (query.onlyManual) {
      qb.andWhere('notification.sentBy IS NOT NULL');
    }

    qb.orderBy('notification.createdAt', 'DESC');
    qb.skip(query.skip).take(query.limit);

    const [data, total] = await qb.getManyAndCount();
    await this.attachTemplateNames(data);

    return new PaginatedResponseDto(data, total, query.page, query.limit);
  }

  /**
   * Names the template each row was composed from, in one query for the page.
   *
   * `withDeleted` on purpose: retiring a template must not blank out the history
   * of everything ever sent from it. The name is looked up rather than stored on
   * the notification because history is read far less often than it is written.
   */
  private async attachTemplateNames(rows: Notification[]): Promise<void> {
    const ids = [
      ...new Set(rows.map((row) => row.templateId).filter(Boolean)),
    ] as string[];

    if (!ids.length) return;

    try {
      const templates = await this.templateRepository.find({
        where: { id: In(ids) },
        withDeleted: true,
        select: { id: true, name: true },
      });

      const nameById = new Map(templates.map((t) => [t.id, t.name]));

      for (const row of rows) {
        row.templateName = row.templateId
          ? nameById.get(row.templateId) || null
          : null;
      }
    } catch (error) {
      // A missing name is a cosmetic gap in an audit list; never fail the read.
      this.logger.warn(
        `Could not resolve template names for notification history: ${
          error?.message || error
        }`,
      );
    }
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
    type?: NotificationType,
  ): Promise<void> {
    const apps = getApps();
    if (!apps.length) {
      // A deployment with no Firebase credentials delivers nothing at all,
      // and used to do it silently. Say it once, not once per notification.
      if (!this.warnedNoFirebase) {
        this.warnedNoFirebase = true;
        this.logger.warn(
          'Firebase is not initialised — no push notification will be delivered. ' +
            'Check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.',
        );
      }
      return;
    }

    const tokens = await this.pushTokenRepository.find({
      where: { userId: In(userIds), isActive: true },
    });

    if (!tokens.length) return;

    // `type` rides along with the deep-link data rather than being stored in
    // the `data` column: the row already has a `type` of its own, and the apps
    // need the same value in the push to know where a tap opens. Without it
    // every tapped push fell through to the notification centre, whatever it
    // was about. It is applied last so a hand-written `data.type` on an
    // admin-composed message cannot disagree with the row it was sent for.
    const dataPayload = this.buildDataPayload(
      type ? { ...(data || {}), type } : data,
    );
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
          ? {
              webpush: {
                fcmOptions: { link: this.webPushLink() },
                // Push services are free to batch normal-urgency messages.
                // The dashboard bell is meant to move as the event lands.
                headers: { Urgency: 'high', TTL: '86400' },
              },
            }
          : {}),
      };
    });

    const result = await messaging.sendEach(messages);

    // Drop tokens FCM reports as permanently gone (uninstalled app, revoked
    // browser permission) so they stop costing a send every time.
    const invalidTokenIds: string[] = [];
    // Every other rejection — a VAPID key that does not match the project, a
    // malformed payload, an expired service account — used to be dropped
    // here, which left "push never arrives" with no evidence anywhere.
    const rejections: string[] = [];

    result.responses.forEach((r, i) => {
      if (r.success) return;
      const code = r.error?.code || 'unknown';
      if (code === 'messaging/registration-token-not-registered') {
        invalidTokenIds.push(tokens[i].id);
        return;
      }
      rejections.push(`${tokens[i].platform}:${code}`);
    });

    if (rejections.length) {
      const tally = rejections.reduce<Record<string, number>>((acc, key) => {
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      const summary = Object.entries(tally)
        .map(([key, count]) => `${key} x${count}`)
        .join(', ');
      this.logger.warn(
        `FCM rejected ${rejections.length}/${messages.length} push message(s): ${summary}`,
      );
    }

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
