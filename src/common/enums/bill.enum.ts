export enum BillType {
  ELECTRICITY = 'electricity',
  GAS = 'gas',
}

export enum BillStatus {
  PENDING_EMAIL = 'pending_email',
  UPLOADED = 'uploaded',
  ANALYZING = 'analyzing',
  ANALYZED = 'analyzed',
  ERROR = 'error',
  VERIFICATION_REQUIRED = 'verification_required',
  OFFER_SENT = 'offer_sent',
  CASE_CREATED = 'case_created',
  CONTRACT_SENT = 'contract_sent',
  CONTRACT_SIGNED = 'contract_signed',
  ACTIVATED = 'activated',
  CANCELLED = 'cancelled',
}

export enum BillSource {
  UPLOAD = 'upload',
  EMAIL = 'email',
}
