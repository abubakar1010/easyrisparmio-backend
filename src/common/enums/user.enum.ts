export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING_VERIFICATION = 'pending_verification',
}

export enum OtpType {
  EMAIL_VERIFICATION = 'email_verification',
  PHONE_VERIFICATION = 'phone_verification',
  PASSWORD_RESET = 'password_reset',
}

export enum DocumentType {
  BILL = 'bill',
  /** @deprecated Legacy identity sub-type — use IDENTITY_VERIFICATION. Kept so existing rows still read. */
  ID_CARD = 'id_card',
  /** @deprecated Legacy identity sub-type — use IDENTITY_VERIFICATION. Kept so existing rows still read. */
  CODICE_FISCALE = 'codice_fiscale',
  CONTRACT = 'contract',
  SIGNED_CONTRACT = 'signed_contract',
  /** @deprecated Legacy identity sub-type — use IDENTITY_VERIFICATION. Kept so existing rows still read. */
  PARTITA_IVA = 'partita_iva',
  /**
   * Every file uploaded in the identity verification section, flat and
   * uncategorized. An ID may arrive as one PDF with front and back, as two
   * files, or as several photos, so the individual files carry no sub-type.
   * Appended last on purpose: reordering rewrites the Postgres enum type.
   */
  IDENTITY_VERIFICATION = 'identity_verification',
}

export enum AuthProvider {
  LOCAL = 'local',
  GOOGLE = 'google',
  FACEBOOK = 'facebook',
  APPLE = 'apple',
}
