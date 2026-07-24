export enum BillType {
  ELECTRICITY = 'electricity',
  GAS = 'gas',
}

export enum BillStatus {
  UPLOADED = 'uploaded',
  ANALYZING = 'analyzing',
  ANALYZED = 'analyzed',
  ERROR = 'error',
  OFFER_SENT = 'offer_sent',
  CASE_CREATED = 'case_created',
  CONTRACT_SENT = 'contract_sent',
  CONTRACT_SIGNED = 'contract_signed',
  ACTIVATED = 'activated',
  CANCELLED = 'cancelled',
}
