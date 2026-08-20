import { BillStatus } from '../../common/enums/bill.enum';
import { NotificationType } from '../../common/enums/notification.enum';

export type MessageKey =
  | 'bill_updated'
  | 'offers_recommended'
  | 'bill_verification_required'
  | 'bill_verified'
  | 'awaiting_activation'
  | 'utility_activated'
  | 'case_update'
  | 'ticket_resolved'
  | 'ticket_closed'
  | 'support_reply'
  | 'referral_registered'
  | 'referral_qualified'
  | 'referral_rewarded'
  | 'referral_expired'
  // Case status changes driven by the admin status dropdown
  | 'status_pending_email'
  | 'status_uploaded'
  | 'status_analyzing'
  | 'status_analyzed'
  | 'status_error'
  | 'status_verification_review'
  | 'status_offer_sent'
  | 'status_offer_accepted'
  | 'status_contract_sent'
  | 'status_cancelled'
  // Admin-facing events. These are only ever delivered to ADMIN recipients by
  // AdminNotificationsService — never to a customer.
  | 'admin_user_registered'
  | 'admin_user_verified'
  | 'admin_bill_uploaded'
  | 'admin_bill_email_requested'
  | 'admin_bill_analyzed'
  | 'admin_bill_analysis_failed'
  | 'admin_verification_submitted'
  | 'admin_offer_accepted'
  | 'admin_case_status_changed'
  | 'admin_document_uploaded'
  | 'admin_ticket_created'
  | 'admin_ticket_replied'
  | 'admin_referral_registered'
  | 'admin_offer_created'
  | 'admin_offer_status_changed';

/** The subset of MessageKey that addresses an admin. */
export type AdminMessageKey = Extract<MessageKey, `admin_${string}`>;

type Lang = 'it' | 'en';

interface MessageDef {
  title: string;
  body: string | ((...args: any[]) => string);
}

const FIELD_LABELS: Record<Lang, Record<string, string>> = {
  it: {
    billType: 'Tipo bolletta',
    podNumber: 'Numero POD',
    pdrNumber: 'Numero PDR',
    totalAmount: 'Importo totale',
    consumptionKwh: 'Consumo (kWh)',
    consumptionSmc: 'Consumo (Smc)',
    costPerUnit: 'Costo unitario',
    fixedCharges: 'Costi fissi',
    taxes: 'Imposte',
    billingPeriodStart: 'Inizio periodo',
    billingPeriodEnd: 'Fine periodo',
    supplyAddress: 'Indirizzo fornitura',
    supplyStreet: 'Indirizzo fornitura',
    supplyStreetNumber: 'Indirizzo fornitura',
    supplyCity: 'Indirizzo fornitura',
    supplyPostalCode: 'Indirizzo fornitura',
    supplyProvince: 'Indirizzo fornitura',
    codiceFiscale: 'Codice Fiscale',
    partitaIva: 'Partita IVA',
    contractNumber: 'Numero contratto',
    meterNumber: 'Numero contatore',
    customerName: 'Nome cliente',
    supplierName: 'Fornitore',
    supplierId: 'Fornitore',
  },
  en: {
    billType: 'Bill type',
    podNumber: 'POD number',
    pdrNumber: 'PDR number',
    totalAmount: 'Total amount',
    consumptionKwh: 'Consumption (kWh)',
    consumptionSmc: 'Consumption (Smc)',
    costPerUnit: 'Cost per unit',
    fixedCharges: 'Fixed charges',
    taxes: 'Taxes',
    billingPeriodStart: 'Billing period start',
    billingPeriodEnd: 'Billing period end',
    supplyAddress: 'Supply address',
    supplyStreet: 'Supply address',
    supplyStreetNumber: 'Supply address',
    supplyCity: 'Supply address',
    supplyPostalCode: 'Supply address',
    supplyProvince: 'Supply address',
    codiceFiscale: 'Tax ID (Codice Fiscale)',
    partitaIva: 'VAT number (Partita IVA)',
    contractNumber: 'Contract number',
    meterNumber: 'Meter number',
    customerName: 'Customer name',
    supplierName: 'Supplier',
    supplierId: 'Supplier',
  },
};

/**
 * Deduplicated on purpose: the supply address is stored as five fields plus the
 * line rendered from them, and editing the street changes several at once. The
 * customer wants to be told their address changed, not to read it named six
 * times, so every part shares one label and repeats are collapsed.
 */
export function resolveFieldLabels(fieldKeys: string[], lang: Lang): string {
  const labels = FIELD_LABELS[lang] || FIELD_LABELS.it;
  return [...new Set(fieldKeys.map((k) => labels[k] || k))].join(', ');
}

const MESSAGES: Record<MessageKey, Record<Lang, MessageDef>> = {
  bill_updated: {
    it: {
      title: 'Dati bolletta aggiornati',
      body: (fieldKeys: string[]) =>
        `I seguenti dati della tua bolletta sono stati aggiornati: ${resolveFieldLabels(fieldKeys, 'it')}`,
    },
    en: {
      title: 'Bill data updated',
      body: (fieldKeys: string[]) =>
        `The following bill data has been updated: ${resolveFieldLabels(fieldKeys, 'en')}`,
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
  bill_verification_required: {
    it: { title: 'Verifica richiesta per la tua bolletta', body: '' },
    en: { title: 'Verification required for your bill', body: '' },
  },
  bill_verified: {
    it: {
      title: 'Bolletta verificata',
      body: 'I dati della tua bolletta sono stati verificati. A breve riceverai le offerte.',
    },
    en: {
      title: 'Bill verified',
      body: 'Your bill data has been verified. You will receive offers shortly.',
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
  case_update: {
    it: {
      title: 'Aggiornamento Pratica',
      body: (caseNumber: string) =>
        `La tua pratica ${caseNumber} è stata aggiornata.`,
    },
    en: {
      title: 'Case Update',
      body: (caseNumber: string) =>
        `Your case ${caseNumber} has been updated.`,
    },
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
  support_reply: {
    it: { title: 'Risposta al ticket di supporto', body: '' },
    en: { title: 'Support ticket reply', body: '' },
  },
  referral_registered: {
    it: {
      title: 'Aggiornamento Referral',
      body: 'Il tuo referral si è registrato!',
    },
    en: {
      title: 'Referral Update',
      body: 'Your referral has registered!',
    },
  },
  referral_qualified: {
    it: {
      title: 'Aggiornamento Referral',
      body: 'Il tuo referral è stato qualificato!',
    },
    en: {
      title: 'Referral Update',
      body: 'Your referral has been qualified!',
    },
  },
  referral_rewarded: {
    it: {
      title: 'Aggiornamento Referral',
      body: (amount: number | string) =>
        `Il tuo premio referral di \u20AC${amount} è stato accreditato!`,
    },
    en: {
      title: 'Referral Update',
      body: (amount: number | string) =>
        `Your referral reward of \u20AC${amount} has been credited!`,
    },
  },
  referral_expired: {
    it: {
      title: 'Aggiornamento Referral',
      body: 'Un referral è scaduto.',
    },
    en: {
      title: 'Referral Update',
      body: 'A referral has expired.',
    },
  },

  // ─── Case status changes ────────────────────────────────────
  // One entry per pipeline status so the customer always receives a
  // meaningful push when an admin moves the case — forward or backward.
  status_pending_email: {
    it: {
      title: 'Pratica in attesa',
      body: 'La tua pratica è in attesa di essere elaborata.',
    },
    en: {
      title: 'Case pending',
      body: 'Your case is waiting to be processed.',
    },
  },
  status_uploaded: {
    it: {
      title: 'Bolletta ricevuta',
      body: 'Abbiamo ricevuto la tua bolletta. La analizzeremo a breve.',
    },
    en: {
      title: 'Bill received',
      body: 'We have received your bill. We will analyse it shortly.',
    },
  },
  status_analyzing: {
    it: {
      title: 'Analisi in corso',
      body: 'Stiamo analizzando la tua bolletta. Ti aggiorneremo appena sarà pronta.',
    },
    en: {
      title: 'Analysis in progress',
      body: 'We are analysing your bill. We will update you as soon as it is ready.',
    },
  },
  status_analyzed: {
    it: {
      title: 'Analisi completata',
      body: "L'analisi della tua bolletta è completata ed è in fase di controllo.",
    },
    en: {
      title: 'Analysis complete',
      body: 'The analysis of your bill is complete and is now being reviewed.',
    },
  },
  status_error: {
    it: {
      title: 'Problema con la bolletta',
      body: 'Si è verificato un problema con la tua bolletta. Il nostro team sta verificando.',
    },
    en: {
      title: 'Problem with your bill',
      body: 'There was a problem with your bill. Our team is looking into it.',
    },
  },
  status_verification_review: {
    it: {
      title: 'Bolletta in verifica',
      body: 'Un nostro operatore sta verificando i dati della tua bolletta.',
    },
    en: {
      title: 'Bill under review',
      body: 'One of our operators is verifying the data on your bill.',
    },
  },
  status_offer_sent: {
    it: {
      title: 'Offerte disponibili',
      body: 'Abbiamo selezionato delle offerte per te. Aprile nella app per sceglierne una.',
    },
    en: {
      title: 'Offers available',
      body: 'We have selected offers for you. Open the app to choose one.',
    },
  },
  status_offer_accepted: {
    it: {
      title: 'Offerta confermata',
      body: 'La tua offerta è stata confermata. Stiamo preparando il contratto.',
    },
    en: {
      title: 'Offer confirmed',
      body: 'Your offer has been confirmed. We are preparing the contract.',
    },
  },
  // The one push that opens the Sign Your Contract screen. Signing happens
  // with the supplier, not in the app, so the copy points at the instructions
  // rather than promising a document to open.
  status_contract_sent: {
    it: {
      title: 'Contratto da firmare',
      body: 'Il tuo contratto è pronto per la firma. Apri la app per vedere come procedere.',
    },
    en: {
      title: 'Contract ready to sign',
      body: 'Your contract is ready to sign. Open the app to see how to proceed.',
    },
  },
  status_cancelled: {
    it: {
      title: 'Pratica annullata',
      body: 'La tua pratica è stata annullata. Contattaci per maggiori informazioni.',
    },
    en: {
      title: 'Case cancelled',
      body: 'Your case has been cancelled. Contact us for more information.',
    },
  },

  // ---------------------------------------------------------------------------
  // Admin-facing copy. Recipients are ADMIN users, so the tone is operational:
  // say who did what and what now needs doing.
  // ---------------------------------------------------------------------------
  admin_user_registered: {
    it: {
      title: 'Nuova registrazione',
      body: (name: string, role: string, email: string) =>
        `${name} (${role}) si è registrato con ${email}.`,
    },
    en: {
      title: 'New registration',
      body: (name: string, role: string, email: string) =>
        `${name} (${role}) signed up with ${email}.`,
    },
  },
  admin_user_verified: {
    it: {
      title: 'Account verificato',
      body: (name: string, email: string) =>
        `${name} ha verificato la propria email (${email}).`,
    },
    en: {
      title: 'Account verified',
      body: (name: string, email: string) =>
        `${name} verified their email address (${email}).`,
    },
  },
  admin_bill_uploaded: {
    it: {
      title: 'Nuova bolletta caricata',
      body: (name: string, billType: string) =>
        `${name} ha caricato una bolletta ${billType}. In attesa di analisi.`,
    },
    en: {
      title: 'New bill uploaded',
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
  admin_bill_analyzed: {
    it: {
      title: 'Analisi bolletta completata',
      body: (name: string, billType: string) =>
        `La bolletta ${billType} di ${name} è stata analizzata ed è pronta per la revisione.`,
    },
    en: {
      title: 'Bill analysis complete',
      body: (name: string, billType: string) =>
        `The ${billType} bill from ${name} has been analysed and is ready for review.`,
    },
  },
  admin_bill_analysis_failed: {
    it: {
      title: 'Analisi bolletta fallita',
      body: (name: string, reason: string) =>
        `Non è stato possibile analizzare la bolletta di ${name}: ${reason}`,
    },
    en: {
      title: 'Bill analysis failed',
      body: (name: string, reason: string) =>
        `Could not analyse the bill from ${name}: ${reason}`,
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
      title: 'Offerta accettata',
      body: (name: string, supplier: string, caseNumber: string) =>
        `${name} ha accettato l'offerta di ${supplier}. Pratica ${caseNumber} creata.`,
    },
    en: {
      title: 'Offer accepted',
      body: (name: string, supplier: string, caseNumber: string) =>
        `${name} accepted the offer from ${supplier}. Case ${caseNumber} created.`,
    },
  },
  admin_case_status_changed: {
    it: {
      title: 'Stato pratica aggiornato',
      body: (caseNumber: string, status: string, actorName: string) =>
        `La pratica ${caseNumber} è passata a "${status}" (${actorName}).`,
    },
    en: {
      title: 'Case status updated',
      body: (caseNumber: string, status: string, actorName: string) =>
        `Case ${caseNumber} moved to "${status}" (${actorName}).`,
    },
  },
  admin_document_uploaded: {
    it: {
      title: 'Nuovo documento caricato',
      body: (name: string, docType: string, caseNumber: string) =>
        `${name} ha caricato un documento (${docType}) sulla pratica ${caseNumber}.`,
    },
    en: {
      title: 'New document uploaded',
      body: (name: string, docType: string, caseNumber: string) =>
        `${name} uploaded a document (${docType}) on case ${caseNumber}.`,
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
  admin_referral_registered: {
    it: {
      title: 'Nuovo referral registrato',
      body: (referrerName: string, refereeName: string) =>
        `${refereeName} si è registrato tramite l'invito di ${referrerName}.`,
    },
    en: {
      title: 'New referral registered',
      body: (referrerName: string, refereeName: string) =>
        `${refereeName} signed up through an invite from ${referrerName}.`,
    },
  },
  admin_offer_created: {
    it: {
      title: 'Nuova offerta creata',
      body: (offerName: string, supplier: string, actorName: string) =>
        `${actorName} ha creato l'offerta "${offerName}" di ${supplier}.`,
    },
    en: {
      title: 'New offer created',
      body: (offerName: string, supplier: string, actorName: string) =>
        `${actorName} created the offer "${offerName}" from ${supplier}.`,
    },
  },
  admin_offer_status_changed: {
    it: {
      title: 'Stato offerta aggiornato',
      body: (offerName: string, status: string, actorName: string) =>
        `L'offerta "${offerName}" è ora "${status}" (${actorName}).`,
    },
    en: {
      title: 'Offer status updated',
      body: (offerName: string, status: string, actorName: string) =>
        `Offer "${offerName}" is now "${status}" (${actorName}).`,
    },
  },
};

/**
 * Notification sent to the customer for each case/bill status.
 *
 * Every status maps to an entry so a push is always delivered when an admin
 * changes the status from the dashboard dropdown — including when the case is
 * moved back to a previous status.
 */
export const BILL_STATUS_NOTIFICATIONS: Record<
  BillStatus,
  { messageKey: MessageKey; type: NotificationType }
> = {
  [BillStatus.PENDING_EMAIL]: {
    messageKey: 'status_pending_email',
    type: NotificationType.GENERAL,
  },
  [BillStatus.UPLOADED]: {
    messageKey: 'status_uploaded',
    type: NotificationType.GENERAL,
  },
  [BillStatus.ANALYZING]: {
    messageKey: 'status_analyzing',
    type: NotificationType.GENERAL,
  },
  [BillStatus.ANALYZED]: {
    messageKey: 'status_analyzed',
    type: NotificationType.BILL_ANALYZED,
  },
  [BillStatus.ERROR]: {
    messageKey: 'status_error',
    type: NotificationType.GENERAL,
  },
  [BillStatus.VERIFICATION_REVIEW]: {
    messageKey: 'status_verification_review',
    type: NotificationType.BILL_VERIFICATION,
  },
  [BillStatus.VERIFICATION_REQUIRED]: {
    messageKey: 'bill_verification_required',
    type: NotificationType.BILL_VERIFICATION,
  },
  [BillStatus.VERIFIED]: {
    messageKey: 'bill_verified',
    type: NotificationType.BILL_ANALYZED,
  },
  [BillStatus.OFFER_SENT]: {
    messageKey: 'status_offer_sent',
    type: NotificationType.OFFER_AVAILABLE,
  },
  [BillStatus.OFFER_ACCEPTED]: {
    messageKey: 'status_offer_accepted',
    type: NotificationType.CASE_UPDATE,
  },
  [BillStatus.CONTRACT_SENT]: {
    messageKey: 'status_contract_sent',
    type: NotificationType.CONTRACT_STATUS,
  },
  [BillStatus.AWAITING_ACTIVATION]: {
    messageKey: 'awaiting_activation',
    type: NotificationType.CONTRACT_STATUS,
  },
  [BillStatus.ACTIVATED]: {
    messageKey: 'utility_activated',
    type: NotificationType.ACTIVATION_COMPLETE,
  },
  [BillStatus.CANCELLED]: {
    messageKey: 'status_cancelled',
    type: NotificationType.CASE_UPDATE,
  },
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
