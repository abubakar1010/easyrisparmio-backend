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
  /**
   * The admin handed the contract over for signing. Everything from here until
   * activation happens outside this application — the customer signs with the
   * supplier directly — so there is no signed/review/verified stage to track.
   */
  CONTRACT_SENT = 'contract_sent',
  AWAITING_ACTIVATION = 'awaiting_activation',
  ACTIVATED = 'activated',
  CANCELLED = 'cancelled',
}

export enum BillSource {
  UPLOAD = 'upload',
  EMAIL = 'email',
}
