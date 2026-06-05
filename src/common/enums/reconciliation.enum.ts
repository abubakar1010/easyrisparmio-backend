export enum ReconciliationStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum ReconRowStatus {
  MATCHED = 'matched',
  NOT_FOUND = 'not_found',
  ERROR = 'error',
  IGNORED = 'ignored',
  MANUALLY_MATCHED = 'manually_matched',
}
