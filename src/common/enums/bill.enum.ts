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
  VERIFICATION_REVIEW = 'verification_review',
  VERIFICATION_REQUIRED = 'verification_required',
  VERIFIED = 'verified',
  OFFER_SENT = 'offer_sent',
  OFFER_ACCEPTED = 'offer_accepted',
  CONTRACT_SENT = 'contract_sent',
  CONTRACT_SIGNED = 'contract_signed',
  CONTRACT_REVIEW = 'contract_review',
  CONTRACT_VERIFICATION_REQUIRED = 'contract_verification_required',
  CONTRACT_VERIFIED = 'contract_verified',
  AWAITING_ACTIVATION = 'awaiting_activation',
  ACTIVATED = 'activated',
  CANCELLED = 'cancelled',
}

export enum BillSource {
  UPLOAD = 'upload',
  EMAIL = 'email',
}
