import { BillStatus } from '../../common/enums/bill.enum';
import { CaseStatus } from '../../common/enums/case.enum';
import { NotificationType } from '../../common/enums/notification.enum';

/**
 * Every piece of copy the platform can send.
 *
 * This union is deliberately closed and short. It used to carry an entry for
 * every `BillStatus`, which meant each new internal state silently became a
 * customer push. Adding a key here now requires adding a trigger for it in
 * NotificationEventsService, which is the only place allowed to send.
 */
export type MessageKey =
  // ─── Customer ───────────────────────────────────────────────
  | 'application_submitted'
  | 'offers_recommended'
  | 'offers_available'
  | 'contract_ready'
  | 'awaiting_activation'
  | 'utility_activated'
  | 'application_cancelled'
  | 'bill_verification_required'
  | 'document_reminder'
  | 'support_reply'
  | 'ticket_resolved'
  | 'ticket_closed'
  | 'referral_qualified'
  | 'referral_rewarded'
  // ─── Admin ──────────────────────────────────────────────────
  // Only ever delivered to ADMIN recipients by AdminNotificationsService.
  | 'admin_bill_uploaded'
  | 'admin_bill_email_requested'
  | 'admin_verification_submitted'
  | 'admin_offer_accepted'
  | 'admin_ticket_created'
  | 'admin_ticket_replied'
  | 'admin_case_stalled';

/** The subset of MessageKey that addresses an admin. */
export type AdminMessageKey = Extract<MessageKey, `admin_${string}`>;

type Lang = 'it' | 'en';

interface MessageDef {
  title: string;
  body: string | ((...args: any[]) => string);
}

const MESSAGES: Record<MessageKey, Record<Lang, MessageDef>> = {
  // ───────────────────────────────────────────────────────────
  // Customer copy. One entry per milestone the customer actually
  // cares about — never per internal state change.
  // ───────────────────────────────────────────────────────────
  application_submitted: {
    it: {
      title: 'Richiesta inviata',
      body: 'Abbiamo ricevuto la tua richiesta. Ti avviseremo appena avremo delle offerte per te.',
    },
    en: {
      title: 'Request sent',
      body: 'We have received your request. We will let you know as soon as we have offers for you.',
    },
  },
  offers_recommended: {
    it: {
      title: 'Nuove offerte consigliate per te',
      body: (count: number, savings: string) =>
        `Abbiamo trovato ${count} offerte migliori per la tua bolletta. Risparmio stimato: EUR ${savings}`,
    },
    en: {
      title: 'New recommended offers for you',
      body: (count: number, savings: string) =>
        `We found ${count} better offers for your bill. Estimated savings: EUR ${savings}`,
    },
  },
  /**
   * The same news as `offers_recommended` without the figures, for when an
   * admin moves the case to "Offerta inviata" from the status dropdown rather
   * than through the send-offers screen. Both share one dedupe key, so a
   * customer only ever receives whichever fired first.
   */
  offers_available: {
    it: {
      title: 'Offerte disponibili',
      body: 'Abbiamo selezionato delle offerte per te. Aprile nella app per sceglierne una.',
    },
    en: {
      title: 'Offers available',
      body: 'We have selected offers for you. Open the app to choose one.',
    },
  },
  // The one push that opens the Sign Your Contract screen. Signing happens
  // with the supplier, not in the app, so the copy points at the instructions
  // rather than promising a document to open.
  contract_ready: {
    it: {
      title: 'Contratto da firmare',
      body: 'Il tuo contratto è pronto per la firma. Apri la app per vedere come procedere.',
    },
    en: {
      title: 'Contract ready to sign',
      body: 'Your contract is ready to sign. Open the app to see how to proceed.',
    },
  },
  awaiting_activation: {
    it: {
      title: 'In attesa di attivazione',
      body: 'La tua utenza è in fase di attivazione. Ti aggiorneremo appena sarà attiva.',
    },
    en: {
      title: 'Awaiting activation',
      body: 'Your utility is being activated. We will update you once it is active.',
    },
  },
  utility_activated: {
    it: {
      title: 'Utenza Attivata',
      body: 'La tua utenza è stata attivata! Puoi vederla nella sezione Le Mie Utenze.',
    },
    en: {
      title: 'Utility Activated',
      body: 'Your utility has been activated! You can view it in the My Utilities section.',
    },
  },
  application_cancelled: {
    it: {
      title: 'Pratica annullata',
      body: 'La tua pratica è stata annullata. Contattaci per maggiori informazioni.',
    },
    en: {
      title: 'Case cancelled',
      body: 'Your case has been cancelled. Contact us for more information.',
    },
  },
  // Body is always overridden with the admin's own message.
  bill_verification_required: {
    it: { title: 'Verifica richiesta per la tua bolletta', body: '' },
    en: { title: 'Verification required for your bill', body: '' },
  },
  /**
   * Sent once, 48 hours after the request, if the document still has not
   * arrived. Repeats what was asked for so the customer does not have to go
   * back and find the original notification.
   */
  document_reminder: {
    it: {
      title: 'Promemoria: documento mancante',
      body: (adminMessage: string) =>
        adminMessage
          ? `Non abbiamo ancora ricevuto quanto richiesto: ${adminMessage}`
          : 'Non abbiamo ancora ricevuto il documento richiesto. Aprilo nella app per caricarlo.',
    },
    en: {
      title: 'Reminder: document still missing',
      body: (adminMessage: string) =>
        adminMessage
          ? `We still have not received what we asked for: ${adminMessage}`
          : 'We still have not received the requested document. Open the app to upload it.',
    },
  },
  support_reply: {
    it: { title: 'Risposta al ticket di supporto', body: '' },
    en: { title: 'Support ticket reply', body: '' },
  },
  ticket_resolved: {
    it: {
      title: 'Ticket risolto',
      body: 'Il tuo ticket di supporto è stato risolto.',
    },
    en: {
      title: 'Ticket Resolved',
      body: 'Your support ticket has been resolved.',
    },
  },
  ticket_closed: {
    it: {
      title: 'Ticket chiuso',
      body: 'Il tuo ticket di supporto è stato chiuso.',
    },
    en: {
      title: 'Ticket Closed',
      body: 'Your support ticket has been closed.',
    },
  },
  referral_qualified: {
    it: {
      title: 'Referral completato',
      body: 'Il tuo referral è stato qualificato!',
    },
    en: {
      title: 'Referral successful',
      body: 'Your referral has been qualified!',
    },
  },
  referral_rewarded: {
    it: {
      title: 'Premio referral accreditato',
      body: (amount: number | string) =>
        `Il tuo premio referral di €${amount} è stato accreditato!`,
    },
    en: {
      title: 'Referral reward credited',
      body: (amount: number | string) =>
        `Your referral reward of €${amount} has been credited!`,
    },
  },

  // ───────────────────────────────────────────────────────────
  // Admin copy. Recipients are ADMIN users, so the tone is operational:
  // say who did what and what now needs doing. Every one of these marks a
  // point where the customer has finished their part and an operator has to
  // pick the case up.
  // ───────────────────────────────────────────────────────────
  admin_bill_uploaded: {
    it: {
      title: 'Nuova richiesta di verifica bolletta',
      body: (name: string, billType: string) =>
        `${name} ha caricato una bolletta ${billType}. In attesa di analisi.`,
    },
    en: {
      title: 'New bill check request',
      body: (name: string, billType: string) =>
        `${name} uploaded a ${billType} bill. Awaiting analysis.`,
    },
  },
  admin_bill_email_requested: {
    it: {
      title: 'Richiesta bolletta via email',
      body: (name: string) =>
        `${name} ha chiesto di inviare la bolletta via email. Carica il documento quando arriva.`,
    },
    en: {
      title: 'Email bill request',
      body: (name: string) =>
        `${name} asked to send their bill by email. Upload the document once it arrives.`,
    },
  },
  admin_verification_submitted: {
    it: {
      title: 'Documenti di verifica ricevuti',
      body: (name: string) =>
        `${name} ha inviato i documenti richiesti. Da rivedere.`,
    },
    en: {
      title: 'Verification documents received',
      body: (name: string) =>
        `${name} submitted the requested documents. Ready for review.`,
    },
  },
  admin_offer_accepted: {
    it: {
      title: 'Nuova pratica inviata',
      body: (name: string, supplier: string, caseNumber: string) =>
        `${name} ha accettato l'offerta di ${supplier}. Pratica ${caseNumber} creata.`,
    },
    en: {
      title: 'New application submitted',
      body: (name: string, supplier: string, caseNumber: string) =>
        `${name} accepted the offer from ${supplier}. Case ${caseNumber} created.`,
    },
  },
  admin_ticket_created: {
    it: {
      title: 'Nuovo ticket di assistenza',
      body: (name: string, subject: string) =>
        `${name} ha aperto un ticket: "${subject}"`,
    },
    en: {
      title: 'New support ticket',
      body: (name: string, subject: string) =>
        `${name} opened a ticket: "${subject}"`,
    },
  },
  admin_ticket_replied: {
    it: {
      title: 'Risposta del cliente',
      body: (name: string, subject: string, preview: string) =>
        `${name} ha risposto su "${subject}": ${preview}`,
    },
    en: {
      title: 'Customer replied',
      body: (name: string, subject: string, preview: string) =>
        `${name} replied on "${subject}": ${preview}`,
    },
  },
  admin_case_stalled: {
    it: {
      title: 'Pratica ferma',
      body: (caseLabel: string, statusLabel: string, days: number) =>
        `La pratica ${caseLabel} è ferma su "${statusLabel}" da ${days} giorni.`,
    },
    en: {
      title: 'Application stalled',
      body: (caseLabel: string, statusLabel: string, days: number) =>
        `Application ${caseLabel} has been sitting in "${statusLabel}" for ${days} days.`,
    },
  },
};

/**
 * A customer-facing milestone: the copy to send and the name the dedupe key is
 * built from. `event` is what makes a milestone reachable from two different
 * status columns without ever notifying twice — both paths derive the same
 * `bill:<id>:<event>` key, so whichever runs first wins and the other is a
 * silent no-op.
 */
export interface CustomerMilestone {
  /** Dedupe-key suffix. Stable — changing it re-opens an already-sent event. */
  event: string;
  messageKey: MessageKey;
  type: NotificationType;
}

const OFFERS_AVAILABLE: CustomerMilestone = {
  event: 'offers_available',
  messageKey: 'offers_available',
  type: NotificationType.OFFER_AVAILABLE,
};
const CONTRACT_READY: CustomerMilestone = {
  event: 'contract_ready',
  messageKey: 'contract_ready',
  type: NotificationType.CONTRACT_STATUS,
};
const IN_ACTIVATION: CustomerMilestone = {
  event: 'in_activation',
  messageKey: 'awaiting_activation',
  type: NotificationType.CONTRACT_STATUS,
};
const ACTIVATED: CustomerMilestone = {
  event: 'activated',
  messageKey: 'utility_activated',
  type: NotificationType.ACTIVATION_COMPLETE,
};
const CANCELLED: CustomerMilestone = {
  event: 'cancelled',
  messageKey: 'application_cancelled',
  type: NotificationType.CASE_UPDATE,
};

/**
 * Which bill statuses the customer hears about at all.
 *
 * Partial on purpose. A status with no entry here is silent, so adding a new
 * internal state cannot accidentally start pushing — the opposite of the total
 * map this replaced, which notified on all fourteen statuses including
 * backward moves. `VERIFICATION_REQUIRED` is absent because its notification
 * carries the admin's own message and is sent by `requestVerification`.
 */
export const CUSTOMER_MILESTONES: Partial<
  Record<BillStatus, CustomerMilestone>
> = {
  [BillStatus.OFFER_SENT]: OFFERS_AVAILABLE,
  [BillStatus.CONTRACT_SENT]: CONTRACT_READY,
  [BillStatus.AWAITING_ACTIVATION]: IN_ACTIVATION,
  [BillStatus.ACTIVATED]: ACTIVATED,
  [BillStatus.CANCELLED]: CANCELLED,
};

/**
 * The same milestones reached from the other status column. `CasesService`
 * can move a case without touching its bill, so both columns map onto one set
 * of events keyed by the bill id.
 */
export const CASE_STATUS_MILESTONES: Partial<
  Record<CaseStatus, CustomerMilestone>
> = {
  [CaseStatus.CONTRACT_SENT]: CONTRACT_READY,
  [CaseStatus.AWAITING_ACTIVATION]: IN_ACTIVATION,
  [CaseStatus.ACTIVATED]: ACTIVATED,
  [CaseStatus.CANCELLED]: CANCELLED,
  [CaseStatus.REJECTED]: CANCELLED,
};

export function getNotificationText(
  key: MessageKey,
  lang: Lang,
  params: any[] = [],
): { title: string; body: string } {
  const msg = MESSAGES[key]?.[lang] || MESSAGES[key]?.['it'];
  if (!msg) {
    return { title: key, body: '' };
  }
  return {
    title: msg.title,
    body: typeof msg.body === 'function' ? msg.body(...params) : msg.body,
  };
}
