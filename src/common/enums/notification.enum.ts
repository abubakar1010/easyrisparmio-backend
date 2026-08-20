export enum NotificationType {
  BILL_ANALYZED = 'bill_analyzed',
  BILL_VERIFICATION = 'bill_verification',
  BILL_UPDATED = 'bill_updated',
  OFFER_AVAILABLE = 'offer_available',
  CASE_UPDATE = 'case_update',
  CONTRACT_STATUS = 'contract_status',
  /**
   * @deprecated Never sent since contract signing moved outside the app. Kept
   * so historic notifications keep reading — a Postgres enum label cannot be
   * dropped while rows still use it.
   */
  CONTRACT_VERIFICATION = 'contract_verification',
  ACTIVATION_COMPLETE = 'activation_complete',
  REFERRAL_STATUS = 'referral_status',
  SUPPORT_REPLY = 'support_reply',
  GENERAL = 'general',

  /**
   * Admin-facing types. These are only ever written with an ADMIN user as the
   * recipient, by AdminNotificationsService. They drive the colour and the type
   * filter on the dashboard notification page; the exact wording of each event
   * comes from its MessageKey, so one type covers several related events.
   */
  ADMIN_USER = 'admin_user',
  ADMIN_BILL = 'admin_bill',
  ADMIN_VERIFICATION = 'admin_verification',
  ADMIN_OFFER_ACCEPTED = 'admin_offer_accepted',
  ADMIN_OFFER = 'admin_offer',
  ADMIN_CASE = 'admin_case',
  ADMIN_DOCUMENT = 'admin_document',
  ADMIN_SUPPORT = 'admin_support',
  ADMIN_REFERRAL = 'admin_referral',
  ADMIN_SYSTEM = 'admin_system',
}

/** Every NotificationType that targets an admin rather than a customer. */
export const ADMIN_NOTIFICATION_TYPES: readonly NotificationType[] = [
  NotificationType.ADMIN_USER,
  NotificationType.ADMIN_BILL,
  NotificationType.ADMIN_VERIFICATION,
  NotificationType.ADMIN_OFFER_ACCEPTED,
  NotificationType.ADMIN_OFFER,
  NotificationType.ADMIN_CASE,
  NotificationType.ADMIN_DOCUMENT,
  NotificationType.ADMIN_SUPPORT,
  NotificationType.ADMIN_REFERRAL,
  NotificationType.ADMIN_SYSTEM,
];

export enum Platform {
  IOS = 'ios',
  ANDROID = 'android',
  /** Firebase web push, used by the admin dashboard. */
  WEB = 'web',
}
