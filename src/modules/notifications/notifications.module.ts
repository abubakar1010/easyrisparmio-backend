import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { AdminNotificationsService } from './admin-notifications.service';
import { NotificationsController } from './notifications.controller';
import { Notification } from './entities/notification.entity';
import { PushToken } from './entities/push-token.entity';
import { UserPreference } from '../users/entities/user-preference.entity';
import { User } from '../users/entities/user.entity';

// `User` is registered as an entity rather than by importing UsersModule:
// AuthModule already imports UsersModule, and AuthModule now imports this
// module too, so pulling UsersModule in here would close a dependency cycle.
@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, PushToken, UserPreference, User]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, AdminNotificationsService],
  exports: [NotificationsService, AdminNotificationsService],
})
export class NotificationsModule {}
