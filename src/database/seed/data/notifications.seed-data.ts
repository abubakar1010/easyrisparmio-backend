import { DataSource } from 'typeorm';
import { Notification } from '../../../modules/notifications/entities/notification.entity';
import { PushToken } from '../../../modules/notifications/entities/push-token.entity';
import {
  NotificationType,
  Platform,
} from '../../../common/enums/notification.enum';
import { SeedContext } from '../seed-context';

export async function seedNotifications(
  ds: DataSource,
  ctx: SeedContext,
): Promise<void> {
  const repo = ds.getRepository(Notification);
  const marco = ctx.users.personal[0];
  const laura = ctx.users.personal[1];
  const giuseppe = ctx.users.business[0];

  const notificationsData = [
    {
      userId: marco.id,
      title: 'Analisi bolletta completata',
      body: 'La tua bolletta elettrica di gennaio è stata analizzata. Potresti risparmiare fino a 32,50 EUR/bimestre.',
      type: NotificationType.BILL_ANALYZED,
      data: { savings: 32.5 },
      isRead: true,
      readAt: new Date('2026-06-15T09:00:00Z'),
    },
    {
      userId: marco.id,
      title: 'Nuova offerta disponibile',
      body: 'Abbiamo trovato un\'offerta che potrebbe farti risparmiare sulla bolletta della luce. Scoprila ora!',
      type: NotificationType.OFFER_AVAILABLE,
      data: { offerCode: 'SEED-ENI-TCL' },
      isRead: false,
    },
    {
      userId: laura.id,
      title: 'Benvenuta su EasyRisparmio',
      body: 'Completa la verifica del tuo account per iniziare a risparmiare sulle bollette.',
      type: NotificationType.GENERAL,
      isRead: false,
    },
    {
      userId: giuseppe.id,
      title: 'Aggiornamento pratica',
      body: 'Il tuo caso SEED-CASE-003 è stato preso in carico. Ti aggiorneremo sui prossimi passi.',
      type: NotificationType.CASE_UPDATE,
      data: { caseNumber: 'SEED-CASE-003' },
      isRead: true,
      readAt: new Date('2026-06-23T08:30:00Z'),
    },
  ];

  for (const data of notificationsData) {
    const count = await repo.count({
      where: { userId: data.userId, title: data.title },
    });
    if (count === 0) {
      await repo.save(repo.create(data));
      console.log(`  Created notification: ${data.title}`);
    } else {
      console.log(`  Notification already exists: ${data.title}`);
    }
  }
}

export async function seedPushTokens(
  ds: DataSource,
  ctx: SeedContext,
): Promise<void> {
  const repo = ds.getRepository(PushToken);
  const marco = ctx.users.personal[0];
  const giuseppe = ctx.users.business[0];

  const tokensData = [
    {
      userId: marco.id,
      token: 'seed-apns-token-marco-001-abcdef1234567890',
      platform: Platform.IOS,
      isActive: true,
    },
    {
      userId: giuseppe.id,
      token: 'seed-fcm-token-giuseppe-001-fedcba0987654321',
      platform: Platform.ANDROID,
      isActive: true,
    },
  ];

  for (const data of tokensData) {
    const existing = await repo.findOne({ where: { token: data.token } });
    if (!existing) {
      await repo.save(repo.create(data));
      console.log(`  Created push token: ${data.platform} for user`);
    } else {
      console.log(`  Push token already exists: ${data.platform}`);
    }
  }
}
