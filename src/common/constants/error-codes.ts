export enum ErrorCode {
  // ─── Auth ────────────────────────────────────────────────
  CANNOT_REGISTER_AS_ADMIN = 'CANNOT_REGISTER_AS_ADMIN',
  EMAIL_ALREADY_REGISTERED = 'EMAIL_ALREADY_REGISTERED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  INVALID_OR_EXPIRED_OTP = 'INVALID_OR_EXPIRED_OTP',
  INVALID_OR_EXPIRED_REFRESH_TOKEN = 'INVALID_OR_EXPIRED_REFRESH_TOKEN',
  INVALID_OR_EXPIRED_RESET_TOKEN = 'INVALID_OR_EXPIRED_RESET_TOKEN',
  INVALID_OR_EXPIRED_VERIFICATION_TOKEN = 'INVALID_OR_EXPIRED_VERIFICATION_TOKEN',
  INVALID_REQUEST = 'INVALID_REQUEST',
  PHONE_OTP_NOT_RESENDABLE = 'PHONE_OTP_NOT_RESENDABLE',
  SOCIAL_LOGIN_FAILED = 'SOCIAL_LOGIN_FAILED',
  EMAIL_OR_TOKEN_REQUIRED = 'EMAIL_OR_TOKEN_REQUIRED',

  // ─── Users ───────────────────────────────────────────────
  USER_NOT_FOUND = 'USER_NOT_FOUND',

  // ─── Bills ───────────────────────────────────────────────
  BILL_NOT_FOUND = 'BILL_NOT_FOUND',
  BILL_ACCESS_DENIED = 'BILL_ACCESS_DENIED',
  BILL_ANALYSIS_NOT_FOUND = 'BILL_ANALYSIS_NOT_FOUND',
  NO_RECOMMENDED_OFFERS = 'NO_RECOMMENDED_OFFERS',

  // ─── Offers ──────────────────────────────────────────────
  OFFER_NOT_FOUND = 'OFFER_NOT_FOUND',
  OFFERS_NOT_FOUND = 'OFFERS_NOT_FOUND',
  OFFER_CODE_CONFLICT = 'OFFER_CODE_CONFLICT',

  // ─── Cases ───────────────────────────────────────────────
  CASE_NOT_FOUND = 'CASE_NOT_FOUND',
  CASE_ACCESS_DENIED = 'CASE_ACCESS_DENIED',
  DOCUMENT_NOT_FOUND = 'DOCUMENT_NOT_FOUND',

  // ─── Contracts ───────────────────────────────────────────
  CONTRACT_NOT_FOUND = 'CONTRACT_NOT_FOUND',
  CONTRACT_ALREADY_EXISTS = 'CONTRACT_ALREADY_EXISTS',
  NO_CONTRACT_FOR_CASE = 'NO_CONTRACT_FOR_CASE',

  // ─── Commissions ─────────────────────────────────────────
  COMMISSION_NOT_FOUND = 'COMMISSION_NOT_FOUND',
  COMMISSION_RULE_NOT_FOUND = 'COMMISSION_RULE_NOT_FOUND',

  // ─── Support ─────────────────────────────────────────────
  TICKET_NOT_FOUND = 'TICKET_NOT_FOUND',
  TICKET_ACCESS_DENIED = 'TICKET_ACCESS_DENIED',
  FAQ_NOT_FOUND = 'FAQ_NOT_FOUND',

  // ─── Notifications ───────────────────────────────────────
  NOTIFICATION_NOT_FOUND = 'NOTIFICATION_NOT_FOUND',
  PUSH_TOKEN_NOT_FOUND = 'PUSH_TOKEN_NOT_FOUND',

  // ─── Suppliers ───────────────────────────────────────────
  SUPPLIER_NOT_FOUND = 'SUPPLIER_NOT_FOUND',

  // ─── Meters ──────────────────────────────────────────────
  METER_NOT_FOUND = 'METER_NOT_FOUND',

  // ─── Agreements ──────────────────────────────────────────
  AGREEMENT_NOT_FOUND = 'AGREEMENT_NOT_FOUND',

  // ─── Referrals ───────────────────────────────────────────
  REFERRAL_NOT_FOUND = 'REFERRAL_NOT_FOUND',
  INVALID_REFERRAL_CODE = 'INVALID_REFERRAL_CODE',

  // ─── File Upload ─────────────────────────────────────────
  NO_FILE_PROVIDED = 'NO_FILE_PROVIDED',
}
