export enum CaseStatus {
  NEW = 'new',
  IN_PROGRESS = 'in_progress',
  DOCUMENTS_PENDING = 'documents_pending',
  /**
   * The contract was handed over for signing. Signing and verification happen
   * outside this application, so the next stop is AWAITING_ACTIVATION.
   */
  CONTRACT_SENT = 'contract_sent',
  ACTIVATED = 'activated',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  /**
   * The supplier switch is under way but not yet confirmed — "In Attivazione".
   * The customer already owns the utility at this point, so it shows up in the
   * app exactly like an activated one, just with a different badge.
   * Appended last on purpose: reordering rewrites the Postgres enum type.
   */
  AWAITING_ACTIVATION = 'awaiting_activation',
}

/**
 * The cases whose utility belongs to the customer: the switch is either running
 * ("In Attivazione") or already done. Every customer-facing utility surface —
 * the activation screen, the utilities list, the utilities count and the
 * potential-savings total — keys off this one set so they can never disagree
 * about which utilities are the customer's.
 */
export const LIVE_UTILITY_CASE_STATUSES: readonly CaseStatus[] = [
  CaseStatus.AWAITING_ACTIVATION,
  CaseStatus.ACTIVATED,
];

/**
 * The cases that no longer hold on to their bill. Every other status means the
 * bill is spoken for: its offers leave the customer's list and no second one
 * can be accepted. Cancelling or rejecting the case frees the bill again.
 */
export const CLOSED_CASE_STATUSES: readonly CaseStatus[] = [
  CaseStatus.CANCELLED,
  CaseStatus.REJECTED,
];

export enum CasePriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  URGENT = 'urgent',
}
