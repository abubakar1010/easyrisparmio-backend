import { BillStatus } from '../../common/enums/bill.enum';

/**
 * The buckets of outstanding work behind the admin panel's "Priority Tasks".
 *
 * A priority task is a thing still to be done, so the buckets are keyed off the
 * *bill* pipeline — the queue every application actually moves through — and
 * not off `switch_cases.status`. A case only comes into existence once the
 * customer has accepted an offer (`CasesService.createCase` requires a selected
 * offer), so counting case statuses missed every application still waiting to
 * be validated and left "Missing Documents" reading zero however many bills
 * were sitting in `verification_required` — that state is reached long before
 * any case exists.
 *
 * The buckets partition the open pipeline: every bill waiting on somebody lands
 * in exactly one of them, so the category counts always sum to the total on the
 * card. Renewals are the one bucket that is not a pipeline stage — an activated
 * case whose contract runs out soon — and it cannot collide with the rest
 * because `activated` is a finished pipeline status.
 */
export enum PriorityTaskCategory {
  /** OCR failed outright — the fields have to be entered by hand. */
  ANALYSIS_FAILED = 'analysis_failed',
  /** The customer asked us to fetch their bill by email; the file is still to be uploaded. */
  EMAIL_BILL_REQUESTS = 'email_bill_requests',
  /** Extracted data waiting for an admin to approve it or send it back. */
  PENDING_VALIDATION = 'pending_validation',
  /** Documents were requested from the customer and have not come back. */
  MISSING_DOCUMENTS = 'missing_documents',
  /** Verified bill with no offers sent yet. */
  OFFERS_TO_SEND = 'offers_to_send',
  /** Offers the customer has been sitting on long enough to warrant a call. */
  FOLLOW_UP_REQUIRED = 'follow_up_required',
  /** Accepted offer through to activation — the contract lane. */
  CONTRACTS_TO_PROCESS = 'contracts_to_process',
  /** A live supply whose contract is about to run out. */
  EXPIRING_CONTRACTS = 'expiring_contracts',
}

export type PriorityTaskSeverity = 'critical' | 'high' | 'medium' | 'low';

/** Whose move it is. Drives the wording, not the counting — both are open work. */
export type PriorityTaskOwner = 'admin' | 'customer';

export interface PriorityTaskDefinition {
  key: PriorityTaskCategory;
  /**
   * Bill statuses that place an application in this bucket. Empty for
   * `EXPIRING_CONTRACTS`, which is driven by the case's expiry date instead.
   */
  billStatuses: readonly BillStatus[];
  severity: PriorityTaskSeverity;
  owner: PriorityTaskOwner;
}

/**
 * Declaration order is display order and, with it, urgency rank — the list
 * endpoint sorts by it, so the most pressing bucket leads both the card and
 * the "all tasks" table.
 */
export const PRIORITY_TASK_DEFINITIONS: readonly PriorityTaskDefinition[] = [
  {
    key: PriorityTaskCategory.ANALYSIS_FAILED,
    billStatuses: [BillStatus.ERROR],
    severity: 'critical',
    owner: 'admin',
  },
  {
    key: PriorityTaskCategory.PENDING_VALIDATION,
    // `uploaded`, `analyzing` and `analyzed` are meant to last seconds — OCR
    // runs in the background and lands on `verification_review`. A bill still
    // sitting in one of them is a stalled pipeline, which is exactly the kind
    // of thing this card exists to surface, so they count here rather than
    // being filtered out as "in flight".
    billStatuses: [
      BillStatus.UPLOADED,
      BillStatus.ANALYZING,
      BillStatus.ANALYZED,
      BillStatus.VERIFICATION_REVIEW,
    ],
    severity: 'high',
    owner: 'admin',
  },
  {
    key: PriorityTaskCategory.EMAIL_BILL_REQUESTS,
    billStatuses: [BillStatus.PENDING_EMAIL],
    severity: 'high',
    owner: 'admin',
  },
  {
    key: PriorityTaskCategory.MISSING_DOCUMENTS,
    billStatuses: [BillStatus.VERIFICATION_REQUIRED],
    severity: 'high',
    owner: 'customer',
  },
  {
    key: PriorityTaskCategory.OFFERS_TO_SEND,
    billStatuses: [BillStatus.VERIFIED],
    severity: 'high',
    owner: 'admin',
  },
  {
    key: PriorityTaskCategory.EXPIRING_CONTRACTS,
    billStatuses: [],
    severity: 'medium',
    owner: 'admin',
  },
  {
    key: PriorityTaskCategory.CONTRACTS_TO_PROCESS,
    billStatuses: [
      BillStatus.OFFER_ACCEPTED,
      BillStatus.CONTRACT_SENT,
      BillStatus.AWAITING_ACTIVATION,
    ],
    severity: 'medium',
    owner: 'admin',
  },
  {
    key: PriorityTaskCategory.FOLLOW_UP_REQUIRED,
    billStatuses: [BillStatus.OFFER_SENT],
    severity: 'low',
    owner: 'customer',
  },
];

/** One outstanding task, as the admin panel lists it. */
export interface PriorityTaskItem {
  /** The bill for a pipeline task, the case for a renewal. Unique per row. */
  id: string;
  category: PriorityTaskCategory;
  /** Where the admin panel opens the task: `/case-management/{billId}`. */
  billId: string | null;
  caseId: string | null;
  caseNumber: string | null;
  /** Bill status for a pipeline task, case status for a renewal. */
  status: string;
  billType: string | null;
  /** POD for electricity, PDR for gas — whichever the bill carries. */
  podPdr: string | null;
  supplierName: string | null;
  amount: number | null;
  /** When the task started waiting: the last real status change. */
  waitingSince: string;
  daysWaiting: number;
  /** Contract expiry as `YYYY-MM-DD`, on renewals only. */
  dueDate: string | null;
  /** Days until `dueDate`; negative once it has passed. */
  daysUntilDue: number | null;
  customer: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    role: string;
  } | null;
}

/**
 * How long an offer may sit unanswered before it becomes a task.
 *
 * An offer the customer has not opened yet is not work anybody owes — it is the
 * customer taking their time, and the scheduler already reminds them. Once a
 * week has gone by it is a phone call somebody owes them, which is what
 * "Follow-up Required / customer contact needed" has always meant on this card.
 */
export const FOLLOW_UP_AFTER_DAYS = 7;

/** How far ahead a contract expiry counts as a renewal to chase. */
export const CONTRACT_EXPIRY_WINDOW_DAYS = 30;

/** Every bill status that puts an application into one of the buckets above. */
export const PRIORITY_TASK_BILL_STATUSES: readonly BillStatus[] =
  PRIORITY_TASK_DEFINITIONS.flatMap((d) => [...d.billStatuses]);

/**
 * `CASE` expression mapping a bill's status onto its bucket, and a second one
 * mapping a bucket onto its urgency rank.
 *
 * Both are generated from the table above rather than written out by hand, so
 * the SQL cannot fall out of step with it — adding a status to a bucket is a
 * one-line edit that the queries pick up for free. Every literal inlined below
 * is a TypeScript enum member, so there is no user input anywhere near it.
 */
export const PRIORITY_TASK_CATEGORY_SQL = `CASE
${PRIORITY_TASK_DEFINITIONS.filter((d) => d.billStatuses.length > 0)
  .map(
    (d) =>
      `        WHEN b.status::text IN (${d.billStatuses
        .map((s) => `'${s}'`)
        .join(', ')}) THEN '${d.key}'`,
  )
  .join('\n')}
      END`;

export const PRIORITY_TASK_RANK_SQL = `CASE t.category
${PRIORITY_TASK_DEFINITIONS.map(
  (d, i) => `        WHEN '${d.key}' THEN ${i + 1}`,
).join('\n')}
        ELSE ${PRIORITY_TASK_DEFINITIONS.length + 1}
      END`;
