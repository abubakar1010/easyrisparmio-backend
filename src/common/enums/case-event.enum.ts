export enum CaseEventType {
  STATUS_CHANGE = 'status_change',
  DOCUMENT_UPLOADED = 'document_uploaded',
  DOCUMENT_VERIFIED = 'document_verified',
  ADMIN_ASSIGNED = 'admin_assigned',
  NOTE_ADDED = 'note_added',
  MESSAGE_SENT = 'message_sent',
  OCR_COMPLETED = 'ocr_completed',
  /**
   * @deprecated Contracts are handled outside the application, so nothing
   * writes these any more. Kept because timeline rows still reference them —
   * a Postgres enum label cannot be dropped while rows use it.
   */
  CONTRACT_GENERATED = 'contract_generated',
  /** @deprecated See {@link CaseEventType.CONTRACT_GENERATED}. */
  CONTRACT_SIGNED = 'contract_signed',
  SYSTEM_EVENT = 'system_event',
}
