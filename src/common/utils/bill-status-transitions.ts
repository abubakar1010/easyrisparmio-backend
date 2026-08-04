import { BillStatus } from '../enums/bill.enum';

/**
 * Allowed status transitions for the unified bill pipeline.
 * Each key maps to the list of statuses it can transition TO.
 */
const ALLOWED_TRANSITIONS: Record<string, BillStatus[]> = {
  [BillStatus.UPLOADED]: [BillStatus.ANALYZING, BillStatus.VERIFICATION_REVIEW],
  [BillStatus.ANALYZING]: [BillStatus.VERIFICATION_REVIEW, BillStatus.ERROR],
  [BillStatus.ANALYZED]: [BillStatus.VERIFICATION_REVIEW],
  [BillStatus.VERIFICATION_REVIEW]: [BillStatus.VERIFIED, BillStatus.VERIFICATION_REQUIRED],
  [BillStatus.VERIFICATION_REQUIRED]: [BillStatus.VERIFICATION_REVIEW],
  [BillStatus.VERIFIED]: [BillStatus.OFFER_SENT],
  [BillStatus.OFFER_SENT]: [BillStatus.OFFER_ACCEPTED],
  [BillStatus.OFFER_ACCEPTED]: [BillStatus.CONTRACT_SENT],
  [BillStatus.CONTRACT_SENT]: [BillStatus.CONTRACT_SIGNED],
  [BillStatus.CONTRACT_SIGNED]: [BillStatus.CONTRACT_REVIEW],
  [BillStatus.CONTRACT_REVIEW]: [BillStatus.CONTRACT_VERIFIED, BillStatus.CONTRACT_VERIFICATION_REQUIRED],
  [BillStatus.CONTRACT_VERIFICATION_REQUIRED]: [BillStatus.CONTRACT_REVIEW],
  [BillStatus.CONTRACT_VERIFIED]: [BillStatus.AWAITING_ACTIVATION],
  [BillStatus.AWAITING_ACTIVATION]: [BillStatus.ACTIVATED],
};

/** Terminal statuses that cannot transition further (except cancellation). */
const TERMINAL_STATUSES: BillStatus[] = [
  BillStatus.ACTIVATED,
  BillStatus.CANCELLED,
  BillStatus.ERROR,
];

/**
 * Checks whether a status transition is valid.
 * Any non-terminal status can also transition to CANCELLED.
 */
export function isValidTransition(from: BillStatus, to: BillStatus): boolean {
  if (TERMINAL_STATUSES.includes(from)) return false;
  if (to === BillStatus.CANCELLED) return true;
  const allowed = ALLOWED_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Returns the list of statuses a bill can transition to from its current status.
 */
export function getAvailableTransitions(status: BillStatus): BillStatus[] {
  if (TERMINAL_STATUSES.includes(status)) return [];
  const allowed = ALLOWED_TRANSITIONS[status] || [];
  return [...allowed, BillStatus.CANCELLED];
}

/** Actor types for transition categorization. */
export type TransitionActor = 'auto' | 'admin' | 'user';

/**
 * Maps each transition to the actor that triggers it.
 * Format: "from->to" => actor
 */
export const TRANSITION_ACTORS: Record<string, TransitionActor> = {
  // Auto (system-triggered)
  [`${BillStatus.UPLOADED}->${BillStatus.ANALYZING}`]: 'auto',
  [`${BillStatus.ANALYZING}->${BillStatus.ANALYZED}`]: 'auto',
  [`${BillStatus.ANALYZED}->${BillStatus.VERIFICATION_REVIEW}`]: 'auto',
  [`${BillStatus.CONTRACT_SIGNED}->${BillStatus.CONTRACT_REVIEW}`]: 'auto',

  // Admin actions
  [`${BillStatus.VERIFICATION_REVIEW}->${BillStatus.VERIFIED}`]: 'admin',
  [`${BillStatus.VERIFICATION_REVIEW}->${BillStatus.VERIFICATION_REQUIRED}`]: 'admin',
  [`${BillStatus.VERIFIED}->${BillStatus.OFFER_SENT}`]: 'admin',
  [`${BillStatus.OFFER_ACCEPTED}->${BillStatus.CONTRACT_SENT}`]: 'admin',
  [`${BillStatus.CONTRACT_REVIEW}->${BillStatus.CONTRACT_VERIFIED}`]: 'admin',
  [`${BillStatus.CONTRACT_REVIEW}->${BillStatus.CONTRACT_VERIFICATION_REQUIRED}`]: 'admin',
  [`${BillStatus.CONTRACT_VERIFIED}->${BillStatus.AWAITING_ACTIVATION}`]: 'admin',
  [`${BillStatus.AWAITING_ACTIVATION}->${BillStatus.ACTIVATED}`]: 'admin',

  // User actions
  [`${BillStatus.OFFER_SENT}->${BillStatus.OFFER_ACCEPTED}`]: 'user',
  [`${BillStatus.CONTRACT_SENT}->${BillStatus.CONTRACT_SIGNED}`]: 'user',
  [`${BillStatus.VERIFICATION_REQUIRED}->${BillStatus.VERIFICATION_REVIEW}`]: 'user',
  [`${BillStatus.CONTRACT_VERIFICATION_REQUIRED}->${BillStatus.CONTRACT_REVIEW}`]: 'user',
};

/**
 * Linear ordering of pipeline statuses for stepper/progress calculation.
 */
export const PIPELINE_STATUS_ORDER: BillStatus[] = [
  BillStatus.UPLOADED,
  BillStatus.ANALYZING,
  BillStatus.ANALYZED,
  BillStatus.VERIFICATION_REVIEW,
  BillStatus.VERIFICATION_REQUIRED,
  BillStatus.VERIFIED,
  BillStatus.OFFER_SENT,
  BillStatus.OFFER_ACCEPTED,
  BillStatus.CONTRACT_SENT,
  BillStatus.CONTRACT_SIGNED,
  BillStatus.CONTRACT_REVIEW,
  BillStatus.CONTRACT_VERIFICATION_REQUIRED,
  BillStatus.CONTRACT_VERIFIED,
  BillStatus.AWAITING_ACTIVATION,
  BillStatus.ACTIVATED,
];
