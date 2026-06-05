export enum AlertType {
  DUPLICATE_POD = 'duplicate_pod',
  CONTRACT_EXPIRING = 'contract_expiring',
  OCR_VERIFICATION = 'ocr_verification',
  HIGH_VALUE_LEAD = 'high_value_lead',
  SLA_BREACH = 'sla_breach',
  MISSING_DOCUMENTS = 'missing_documents',
}

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

export enum AlertStatus {
  ACTIVE = 'active',
  ACKNOWLEDGED = 'acknowledged',
  RESOLVED = 'resolved',
  DISMISSED = 'dismissed',
}
