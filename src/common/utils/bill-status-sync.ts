import { BillStatus } from '../enums/bill.enum';
import { CaseStatus } from '../enums/case.enum';

const CASE_TO_BILL_PRIORITY: Record<string, { billStatus: BillStatus; priority: number }> = {
  [CaseStatus.ACTIVATED]:         { billStatus: BillStatus.ACTIVATED, priority: 5 },
  [CaseStatus.CONTRACT_SIGNED]:   { billStatus: BillStatus.CONTRACT_SIGNED, priority: 4 },
  [CaseStatus.CONTRACT_SENT]:     { billStatus: BillStatus.CONTRACT_SENT, priority: 3 },
  [CaseStatus.IN_PROGRESS]:       { billStatus: BillStatus.CASE_CREATED, priority: 2 },
  [CaseStatus.DOCUMENTS_PENDING]: { billStatus: BillStatus.CASE_CREATED, priority: 2 },
  [CaseStatus.NEW]:               { billStatus: BillStatus.CASE_CREATED, priority: 1 },
  [CaseStatus.REJECTED]:          { billStatus: BillStatus.CANCELLED, priority: 0 },
  [CaseStatus.CANCELLED]:         { billStatus: BillStatus.CANCELLED, priority: 0 },
};

/**
 * Resolves the bill status from all associated case statuses.
 * Uses priority-based resolution: the most advanced active case determines the bill status.
 */
export function resolveBillStatusFromCases(caseStatuses: CaseStatus[]): BillStatus {
  if (caseStatuses.length === 0) return BillStatus.CASE_CREATED;

  let bestPriority = -1;
  let bestBillStatus: BillStatus = BillStatus.CANCELLED;

  for (const cs of caseStatuses) {
    const mapping = CASE_TO_BILL_PRIORITY[cs];
    if (mapping && mapping.priority > bestPriority) {
      bestPriority = mapping.priority;
      bestBillStatus = mapping.billStatus;
    }
  }

  return bestBillStatus;
}
