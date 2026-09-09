import { BillStatus } from '../../common/enums/bill.enum';
import {
  PRIORITY_TASK_BILL_STATUSES,
  PRIORITY_TASK_CATEGORY_SQL,
  PRIORITY_TASK_DEFINITIONS,
  PRIORITY_TASK_RANK_SQL,
  PriorityTaskCategory,
} from './priority-tasks.constant';

/**
 * The dashboard card promises that its bucket counts add up to the total it
 * shows, and that clicking a count opens exactly that many rows. Both rest on
 * the buckets partitioning the pipeline and on the SQL agreeing with the table
 * these tests read — so both are pinned here rather than left to a code review.
 */
describe('priority task buckets', () => {
  /** Statuses that are finished, and so are nobody's outstanding work. */
  const CLOSED_STATUSES: BillStatus[] = [
    BillStatus.ACTIVATED,
    BillStatus.CANCELLED,
  ];

  it('never puts one bill status in two buckets', () => {
    const seen = new Set<BillStatus>();
    const duplicated: BillStatus[] = [];

    for (const definition of PRIORITY_TASK_DEFINITIONS) {
      for (const status of definition.billStatuses) {
        if (seen.has(status)) duplicated.push(status);
        seen.add(status);
      }
    }

    expect(duplicated).toEqual([]);
  });

  it('accounts for every pipeline status that is still open', () => {
    const open = Object.values(BillStatus).filter(
      (status) => !CLOSED_STATUSES.includes(status),
    );

    expect([...PRIORITY_TASK_BILL_STATUSES].sort()).toEqual(open.sort());
  });

  it('leaves finished applications out of the buckets', () => {
    for (const status of CLOSED_STATUSES) {
      expect(PRIORITY_TASK_BILL_STATUSES).not.toContain(status);
    }
  });

  it('keeps renewals off the bill pipeline', () => {
    // Renewals key off a case's expiry date. Giving the bucket bill statuses
    // too would double-count the contract lane and break the total.
    const renewals = PRIORITY_TASK_DEFINITIONS.find(
      (d) => d.key === PriorityTaskCategory.EXPIRING_CONTRACTS,
    );

    expect(renewals).toBeDefined();
    expect(renewals?.billStatuses).toEqual([]);
  });

  describe('generated SQL', () => {
    it('maps every bucketed status to its own bucket', () => {
      for (const definition of PRIORITY_TASK_DEFINITIONS) {
        for (const status of definition.billStatuses) {
          expect(PRIORITY_TASK_CATEGORY_SQL).toContain(`'${status}'`);
        }
        if (definition.billStatuses.length > 0) {
          expect(PRIORITY_TASK_CATEGORY_SQL).toContain(`THEN '${definition.key}'`);
        }
      }
    });

    it('does not try to match a status on the renewal bucket', () => {
      expect(PRIORITY_TASK_CATEGORY_SQL).not.toContain(
        `THEN '${PriorityTaskCategory.EXPIRING_CONTRACTS}'`,
      );
    });

    it('ranks the buckets in the order they are declared', () => {
      PRIORITY_TASK_DEFINITIONS.forEach((definition, index) => {
        expect(PRIORITY_TASK_RANK_SQL).toContain(
          `WHEN '${definition.key}' THEN ${index + 1}`,
        );
      });
    });

    it('ranks an unknown bucket last rather than dropping it', () => {
      expect(PRIORITY_TASK_RANK_SQL).toContain(
        `ELSE ${PRIORITY_TASK_DEFINITIONS.length + 1}`,
      );
    });
  });
});
