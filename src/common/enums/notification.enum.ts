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
}

export enum Platform {
  IOS = 'ios',
  ANDROID = 'android',
}
