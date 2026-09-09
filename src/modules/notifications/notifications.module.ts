import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { AdminNotificationsService } from './admin-notifications.service';
import { NotificationEventsService } from './notification-events.service';
import { NotificationSchedulerService } from './notification-scheduler.service';
import { NotificationsController } from './notifications.controller';
import { NotificationTemplatesService } from './notification-templates.service';
import { NotificationTemplatesController } from './notification-templates.controller';
import { Notification } from './entities/notification.entity';
import { NotificationTemplate } from './entities/notification-template.entity';
import { SwitchCase } from '../cases/entities/switch-case.entity';
import { PushToken } from './entities/push-token.entity';
import { UserPreference } from '../users/entities/user-preference.entity';
import { User } from '../users/entities/user.entity';
import { EnergyBill } from '../bills/entities/energy-bill.entity';
import { BillVerification } from '../bills/entities/bill-verification.entity';

// Entities are registered here rather than by importing the modules that own
// them, because those modules already depend on this one — BillsModule and
// ReferralsModule import it for the trigger layer, and ReferralsModule also
// imports UsersModule. Importing them back would close the loop. The scheduler
// only ever reads `EnergyBill` and `BillVerification`, and variable
// substitution only reads `User` and `SwitchCase` (plus the offer and supplier
// it joins through), so repositories are all they need. CasesModule in
// particular must not be imported: it already depends on this one.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      PushToken,
      UserPreference,
      User,
      EnergyBill,
      BillVerification,
      SwitchCase,
      NotificationTemplate,
    ]),
  ],
  controllers: [NotificationsController, NotificationTemplatesController],
  providers: [
    NotificationsService,
    NotificationTemplatesService,
    AdminNotificationsService,
    NotificationEventsService,
    NotificationSchedulerService,
  ],
  exports: [
    NotificationsService,
    NotificationTemplatesService,
    AdminNotificationsService,
    NotificationEventsService,
  ],
})
export class NotificationsModule {}
