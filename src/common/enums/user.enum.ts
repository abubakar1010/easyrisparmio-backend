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
  ID_CARD = 'id_card',
  CODICE_FISCALE = 'codice_fiscale',
  CONTRACT = 'contract',
  SIGNED_CONTRACT = 'signed_contract',
  PARTITA_IVA = 'partita_iva',
}

export enum AuthProvider {
  LOCAL = 'local',
  GOOGLE = 'google',
  FACEBOOK = 'facebook',
  APPLE = 'apple',
}
