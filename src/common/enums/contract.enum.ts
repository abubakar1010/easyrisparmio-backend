export enum ContractStatus {
  DRAFT = 'draft',
  SENT = 'sent',
  SIGNED = 'signed',
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
}

export enum ContractDeliveryMethod {
  APP = 'app',
  EMAIL = 'email',
}

export enum ContractDocumentType {
  CONTRACT = 'contract',
  SIGNED = 'signed',
}
