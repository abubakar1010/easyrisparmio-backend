export enum CaseStatus {
  NEW = 'new',
  IN_PROGRESS = 'in_progress',
  DOCUMENTS_PENDING = 'documents_pending',
  CONTRACT_SENT = 'contract_sent',
  CONTRACT_SIGNED = 'contract_signed',
  ACTIVATED = 'activated',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
}

export enum CasePriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}
