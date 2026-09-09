/**
 * Drives the icon, colour and deep-link the apps use for a notification, and
 * the type filter on the dashboard.
 *
 * Several values are `@deprecated`: the trigger that produced them was removed
 * when notifications were narrowed to the events people actually act on. They
 * stay declared because rows still carry them — a Postgres enum label cannot
 * be dropped while any row uses it — and because the apps must keep rendering
 * historic notifications. Do not emit a deprecated value from new code.
 */
export enum NotificationType {
  /**
   * @deprecated Analysis is an internal step and no longer notifies the
   * customer; they hear from us when offers are ready.
   */
  BILL_ANALYZED = 'bill_analyzed',
  BILL_VERIFICATION = 'bill_verification',
  /**
   * @deprecated Fired on every admin edit of a bill field, which is exactly
   * the per-save noise this system was cleaned up to remove.
   */
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
  /** @deprecated Sign-ups and email verifications no longer notify admins. */
  ADMIN_USER = 'admin_user',
  ADMIN_BILL = 'admin_bill',
  ADMIN_VERIFICATION = 'admin_verification',
  ADMIN_OFFER_ACCEPTED = 'admin_offer_accepted',
  /** @deprecated Admins are no longer notified of their own catalogue edits. */
  ADMIN_OFFER = 'admin_offer',
  ADMIN_CASE = 'admin_case',
  /**
   * @deprecated Case documents have no "requested" state, so an upload of one
   * cannot mean the customer completed something we asked for. The requested
   * -document path notifies through ADMIN_VERIFICATION instead.
   */
  ADMIN_DOCUMENT = 'admin_document',
  ADMIN_SUPPORT = 'admin_support',
  /** @deprecated Referral sign-ups need no operator intervention. */
  ADMIN_REFERRAL = 'admin_referral',
  /** @deprecated Declared but never emitted. */
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
