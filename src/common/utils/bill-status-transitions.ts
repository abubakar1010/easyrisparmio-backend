import { BillStatus } from '../enums/bill.enum';

/**
 * Allowed status transitions for the unified bill pipeline.
 * Each key maps to the list of statuses it can transition TO.
 *
 * Contract signing happens outside this application: the admin hands the
 * contract over (CONTRACT_SENT) and, once the customer has signed with the
 * supplier and the supplier has accepted it, moves straight to
 * AWAITING_ACTIVATION with the activation and expiry dates.
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
  [BillStatus.CONTRACT_SENT]: [BillStatus.AWAITING_ACTIVATION],
  [BillStatus.AWAITING_ACTIVATION]: [BillStatus.ACTIVATED],
};

/** Terminal statuses that cannot transition further (except cancellation). */
const TERMINAL_STATUSES: BillStatus[] = [
  BillStatus.ACTIVATED,
  BillStatus.CANCELLED,
  BillStatus.ERROR,
];

/**
 * Checks whether a status transition follows the standard pipeline order.
 * Any non-terminal status can also transition to CANCELLED.
 *
 * NOTE: this is advisory only — administrators are allowed to set any status
 * directly from the case status dropdown (see `ADMIN_SELECTABLE_STATUSES`).
 * It is used to flag the *recommended* next steps in the admin UI.
 */
export function isValidTransition(from: BillStatus, to: BillStatus): boolean {
  if (TERMINAL_STATUSES.includes(from)) return false;
  if (to === BillStatus.CANCELLED) return true;
  const allowed = ALLOWED_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Returns the statuses that follow the standard pipeline order from `status`.
 * These are surfaced as "recommended next steps" in the admin UI.
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

  // Admin actions
  [`${BillStatus.VERIFICATION_REVIEW}->${BillStatus.VERIFIED}`]: 'admin',
  [`${BillStatus.VERIFICATION_REVIEW}->${BillStatus.VERIFICATION_REQUIRED}`]: 'admin',
  [`${BillStatus.VERIFIED}->${BillStatus.OFFER_SENT}`]: 'admin',
  [`${BillStatus.OFFER_ACCEPTED}->${BillStatus.CONTRACT_SENT}`]: 'admin',
  [`${BillStatus.CONTRACT_SENT}->${BillStatus.AWAITING_ACTIVATION}`]: 'admin',
  [`${BillStatus.AWAITING_ACTIVATION}->${BillStatus.ACTIVATED}`]: 'admin',

  // User actions
  [`${BillStatus.OFFER_SENT}->${BillStatus.OFFER_ACCEPTED}`]: 'user',
  [`${BillStatus.VERIFICATION_REQUIRED}->${BillStatus.VERIFICATION_REVIEW}`]: 'user',
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
  BillStatus.AWAITING_ACTIVATION,
  BillStatus.ACTIVATED,
];

/**
 * Statuses an administrator may set directly from the case status dropdown.
 * The admin is NOT bound to the pipeline order — any of these can be selected
 * at any time, both forward and backward.
 *
 * `PENDING_EMAIL` and `ERROR` are excluded: they are system-managed states
 * (a bill that has no owner yet / an OCR failure) and are never a meaningful
 * destination for a manual move. A bill sitting in one of them can still be
 * moved *out* to any status below.
 */
export const ADMIN_SELECTABLE_STATUSES: BillStatus[] = [
  ...PIPELINE_STATUS_ORDER,
  BillStatus.CANCELLED,
];

export type TransitionDirection = 'forward' | 'backward' | 'lateral';

/**
 * Where a status change sits relative to the pipeline order. Statuses outside
 * the pipeline (cancelled / error / pending_email) resolve to 'lateral'.
 */
export function getTransitionDirection(
  from: BillStatus,
  to: BillStatus,
): TransitionDirection {
  const fromIdx = PIPELINE_STATUS_ORDER.indexOf(from);
  const toIdx = PIPELINE_STATUS_ORDER.indexOf(to);
  if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return 'lateral';
  return toIdx > fromIdx ? 'forward' : 'backward';
}

/** Human-readable status names, used for timeline entries and log messages. */
export const BILL_STATUS_LABELS: Record<BillStatus, string> = {
  [BillStatus.PENDING_EMAIL]: 'Pending (Email)',
  [BillStatus.UPLOADED]: 'Uploaded',
  [BillStatus.ANALYZING]: 'Analyzing',
  [BillStatus.ANALYZED]: 'Analyzed',
  [BillStatus.ERROR]: 'Error',
  [BillStatus.VERIFICATION_REVIEW]: 'Verification Review',
  [BillStatus.VERIFICATION_REQUIRED]: 'Verification Required',
  [BillStatus.VERIFIED]: 'Verified',
  [BillStatus.OFFER_SENT]: 'Offer Sent',
  [BillStatus.OFFER_ACCEPTED]: 'Offer Accepted',
  [BillStatus.CONTRACT_SENT]: 'Contract Sent',
  [BillStatus.AWAITING_ACTIVATION]: 'In Activation',
  [BillStatus.ACTIVATED]: 'Activated',
  [BillStatus.CANCELLED]: 'Cancelled',
};
