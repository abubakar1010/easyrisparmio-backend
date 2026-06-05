import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { PushToken } from './entities/push-token.entity';
import { SendNotificationDto } from './dto/send-notification.dto';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { PaginatedResponseDto } from '../../common/dto/pagination.dto';
import { Platform } from '../../common/enums/notification.enum';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
    @InjectRepository(PushToken)
    private readonly pushTokenRepository: Repository<PushToken>,
  ) {}

  async sendNotification(
    dto: SendNotificationDto,
  ): Promise<Notification | Notification[]> {
    const userIds = dto.userIds || (dto.userId ? [dto.userId] : []);

    const notifications = userIds.map((uid) =>
      this.notificationRepository.create({
        userId: uid,
        title: dto.title,
        body: dto.body,
        type: dto.type,
        data: dto.data || null,
      }),
    );

    const saved = await this.notificationRepository.save(notifications);
    return saved.length === 1 ? saved[0] : saved;
  }

  async getUserNotifications(
    userId: string,
    query: QueryNotificationsDto,
  ): Promise<PaginatedResponseDto<Notification>> {
    const qb = this.notificationRepository
      .createQueryBuilder('notification')
      .where('notification.user_id = :userId', { userId });

    if (query.type) {
      qb.andWhere('notification.type = :type', { type: query.type });
    }

    if (query.isRead !== undefined) {
      qb.andWhere('notification.is_read = :isRead', { isRead: query.isRead });
    }

    qb.orderBy('notification.created_at', 'DESC');
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
    return this.notificationRepository.save(notification);
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.notificationRepository.update(
      { userId, isRead: false },
      { isRead: true },
    );
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
}
