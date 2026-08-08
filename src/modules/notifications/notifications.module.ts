import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { Notification } from './entities/notification.entity';
import { PushToken } from './entities/push-token.entity';
import { UserPreference } from '../users/entities/user-preference.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Notification, PushToken, UserPreference])],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
