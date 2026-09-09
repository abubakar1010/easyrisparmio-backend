import { DataSource } from 'typeorm';
import { Notification } from '../../../modules/notifications/entities/notification.entity';
import { PushToken } from '../../../modules/notifications/entities/push-token.entity';
import { NotificationTemplate } from '../../../modules/notifications/entities/notification-template.entity';
import {
  NotificationType,
  Platform,
} from '../../../common/enums/notification.enum';
import { NotificationTemplateCategory } from '../../../common/enums/notification-template.enum';
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

export async function seedNotificationTemplates(
  ds: DataSource,
  ctx: SeedContext,
): Promise<void> {
  const repo = ds.getRepository(NotificationTemplate);
  const admin = ctx.users.admin ?? null;

  /**
   * Starting points for the messages an operator sends by hand from a
   * customer's profile — one per category the client asked for.
   *
   * Two things worth knowing when adding to this list:
   *
   * - `{{provider}}`, `{{offer_name}}` and `{{utility_type}}` read from the
   *   customer's most recent case, so a template using them cannot be sent to
   *   someone who has not chosen an offer yet — the send is refused rather than
   *   delivering a half-written sentence. The first promotional template
   *   deliberately uses only name variables so it can go to anyone, including a
   *   fresh sign-up.
   *
   * - `type` drives the icon and colour in the apps. It also drives the mobile
   *   deep link, but a hand-composed message carries no `billId`, so tapping one
   *   lands on the notification list rather than a record. That is the existing
   *   behaviour for manual sends and is why the copy says "nella app" rather
   *   than promising a particular screen.
   */
  const templatesData: Array<Partial<NotificationTemplate>> = [
    {
      name: 'Promo — nuove offerte disponibili',
      description:
        'Invito generico a confrontare le offerte. Nessuna variabile di pratica, quindi inviabile a qualsiasi cliente.',
      category: NotificationTemplateCategory.PROMOTIONAL,
      type: NotificationType.OFFER_AVAILABLE,
      title: 'Una nuova offerta per te, {{firstName}}',
      body: 'Ciao {{name}}, abbiamo trovato nuove offerte che possono ridurre la tua bolletta. Aprile nella app per confrontarle.',
    },
    {
      name: 'Promo — completa il passaggio',
      description:
        'Sollecito per un cliente che ha scelto un\'offerta ma non ha completato il passaggio.',
      category: NotificationTemplateCategory.PROMOTIONAL,
      type: NotificationType.OFFER_AVAILABLE,
      title: '{{offer_name}} ti aspetta',
      body: 'Ciao {{firstName}}, l\'offerta {{offer_name}} di {{provider}} per la tua fornitura {{utility_type}} è ancora disponibile. Completa il passaggio quando vuoi.',
    },
    {
      name: 'Documenti da ricaricare',
      description:
        'Richiesta di ricaricare un documento illeggibile o mancante sulla pratica.',
      category: NotificationTemplateCategory.DOCUMENT_REQUEST,
      type: NotificationType.BILL_VERIFICATION,
      title: 'Documenti da ricaricare',
      body: 'Ciao {{firstName}}, per proseguire con la tua pratica {{utility_type}} abbiamo bisogno che tu ricarichi un documento. Trovi il dettaglio nella app.',
    },
    {
      name: 'Documenti — bolletta illeggibile',
      description:
        'Variante per una bolletta caricata ma non leggibile. Nessuna variabile di pratica.',
      category: NotificationTemplateCategory.DOCUMENT_REQUEST,
      type: NotificationType.BILL_VERIFICATION,
      title: 'Non riusciamo a leggere la tua bolletta',
      body: 'Ciao {{firstName}}, il documento che hai caricato non è leggibile. Puoi ricaricarlo dalla app? Bastano una foto nitida o il PDF originale.',
    },
    {
      name: 'Aggiornamento pratica',
      description: 'Aggiornamento generico sullo stato della pratica in corso.',
      category: NotificationTemplateCategory.CASE_UPDATE,
      type: NotificationType.CASE_UPDATE,
      title: 'Aggiornamento sulla tua pratica',
      body: 'Ciao {{firstName}}, la tua pratica {{utility_type}} con {{provider}} è stata aggiornata. Controlla lo stato nella app.',
    },
    {
      name: 'Attivazione completata',
      description: 'Conferma che la nuova fornitura è attiva.',
      category: NotificationTemplateCategory.CASE_UPDATE,
      type: NotificationType.ACTIVATION_COMPLETE,
      title: 'La tua fornitura {{utility_type}} è attiva',
      body: 'Ciao {{name}}, la fornitura {{utility_type}} con {{provider}} è ora attiva. Grazie per aver scelto EasyRisparmio.',
    },
    {
      name: 'Comunicazione personalizzata',
      description:
        'Punto di partenza vuoto: saluto già impostato, il resto lo scrive l\'operatore.',
      category: NotificationTemplateCategory.CUSTOM,
      type: NotificationType.GENERAL,
      title: 'Comunicazione da EasyRisparmio',
      body: 'Ciao {{name}},\n\n',
    },
  ];

  for (const data of templatesData) {
    const existing = await repo.findOne({ where: { name: data.name } });
    if (existing) {
      console.log(`  Notification template already exists: ${data.name}`);
      continue;
    }

    await repo.save(
      repo.create({
        ...data,
        isActive: true,
        createdBy: admin?.id ?? null,
        updatedBy: admin?.id ?? null,
      }),
    );
    console.log(`  Created notification template: ${data.name}`);
  }
}
