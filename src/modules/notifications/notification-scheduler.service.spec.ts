import { NotificationSchedulerService } from './notification-scheduler.service';
import { BillStatus } from '../../common/enums/bill.enum';
import { VerificationStatus } from '../bills/entities/bill-verification.entity';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** A chainable query-builder stand-in that records every clause. */
const makeQb = (getMany: jest.Mock) => {
  const qb: Record<string, jest.Mock> = {
    leftJoinAndSelect: jest.fn(() => qb),
    where: jest.fn(() => qb),
    andWhere: jest.fn(() => qb),
    orderBy: jest.fn(() => qb),
    take: jest.fn(() => qb),
    getMany,
  };
  return qb;
};

/** The parameter object handed to a named `.where`/`.andWhere` clause. */
const paramsFor = (qb: Record<string, jest.Mock>, fragment: string) => {
  const calls = [...qb.where.mock.calls, ...qb.andWhere.mock.calls];
  return calls.find(([sql]) => String(sql).includes(fragment))?.[1];
};

const sqlFor = (qb: Record<string, jest.Mock>, fragment: string) => {
  const calls = [...qb.where.mock.calls, ...qb.andWhere.mock.calls];
  return calls.find(([sql]) => String(sql).includes(fragment))?.[0] as
    | string
    | undefined;
};

describe('NotificationSchedulerService.sendPendingDocumentReminders', () => {
  let getMany: jest.Mock;
  let qb: Record<string, jest.Mock>;
  let documentReminder: jest.Mock;
  let scheduler: NotificationSchedulerService;

  const verification = (over: Record<string, unknown> = {}) => ({
    id: 'v1',
    billId: 'b1',
    adminMessage: 'La bolletta è illeggibile.',
    bill: { id: 'b1', userId: 'u1', billType: 'electricity' },
    ...over,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    getMany = jest.fn().mockResolvedValue([]);
    qb = makeQb(getMany);
    documentReminder = jest.fn().mockResolvedValue(undefined);

    scheduler = new NotificationSchedulerService(
      { createQueryBuilder: jest.fn(() => qb) } as any,
      { createQueryBuilder: jest.fn() } as any,
      { documentReminder } as any,
    );
  });

  it('only considers requests still waiting on the customer', async () => {
    await scheduler.sendPendingDocumentReminders();

    // This clause is the whole cancellation mechanism: uploading flips the row
    // to SUBMITTED, so it stops matching and no reminder is ever sent.
    expect(paramsFor(qb, 'verification.status').status).toBe(
      VerificationStatus.PENDING,
    );
  });

  it('waits a full 48 hours before nudging', async () => {
    await scheduler.sendPendingDocumentReminders();

    expect(paramsFor(qb, 'INTERVAL').hours).toBe(48);
  });

  it('lets Postgres compute the cutoff rather than passing a JS Date', async () => {
    await scheduler.sendPendingDocumentReminders();

    // Regression guard. `bill_verifications.created_at` is `timestamp WITHOUT
    // time zone`, so comparing it to a JS Date fired the reminder hours early
    // — by exactly the server's UTC offset. Both sides must be SQL-side.
    const clause = sqlFor(qb, 'verification.createdAt');
    expect(clause).toContain('NOW()');
    expect(clause).toContain("INTERVAL '1 hour'");
  });

  it('reminds the owner of every overdue request', async () => {
    getMany.mockResolvedValue([
      verification(),
      verification({ id: 'v2', billId: 'b2', bill: { id: 'b2', userId: 'u2' } }),
    ]);

    await scheduler.sendPendingDocumentReminders();

    expect(documentReminder).toHaveBeenCalledTimes(2);
    expect(documentReminder.mock.calls[0][0]).toMatchObject({
      id: 'v1',
      adminMessage: 'La bolletta è illeggibile.',
    });
    expect(documentReminder.mock.calls[0][1]).toMatchObject({ userId: 'u1' });
  });

  it('skips a request whose bill has gone', async () => {
    getMany.mockResolvedValue([verification({ bill: null })]);

    await scheduler.sendPendingDocumentReminders();

    expect(documentReminder).not.toHaveBeenCalled();
  });

  it('survives a database failure without throwing at the scheduler', async () => {
    getMany.mockRejectedValue(new Error('connection lost'));

    await expect(
      scheduler.sendPendingDocumentReminders(),
    ).resolves.toBeUndefined();
  });
});

describe('NotificationSchedulerService.flagStalledApplications', () => {
  let getMany: jest.Mock;
  let qb: Record<string, jest.Mock>;
  let applicationStalled: jest.Mock;
  let scheduler: NotificationSchedulerService;

  beforeEach(() => {
    jest.clearAllMocks();
    getMany = jest.fn().mockResolvedValue([]);
    qb = makeQb(getMany);
    applicationStalled = jest.fn().mockResolvedValue(undefined);

    scheduler = new NotificationSchedulerService(
      { createQueryBuilder: jest.fn() } as any,
      { createQueryBuilder: jest.fn(() => qb) } as any,
      { adminApplicationStalled: applicationStalled } as any,
    );
  });

  it('looks only at statuses where the next move is ours', async () => {
    await scheduler.flagStalledApplications();

    const { statuses } = paramsFor(qb, 'bill.status IN');

    expect(statuses).toEqual(
      expect.arrayContaining([
        BillStatus.VERIFICATION_REVIEW,
        BillStatus.VERIFIED,
        BillStatus.OFFER_ACCEPTED,
      ]),
    );
    // Waiting on the customer, waiting on the supplier, or finished — none of
    // these is the operator being slow.
    expect(statuses).not.toContain(BillStatus.VERIFICATION_REQUIRED);
    expect(statuses).not.toContain(BillStatus.OFFER_SENT);
    expect(statuses).not.toContain(BillStatus.CONTRACT_SENT);
    expect(statuses).not.toContain(BillStatus.AWAITING_ACTIVATION);
    expect(statuses).not.toContain(BillStatus.ACTIVATED);
    expect(statuses).not.toContain(BillStatus.CANCELLED);
  });

  it('measures from the status change, not from the last save', async () => {
    await scheduler.flagStalledApplications();

    const clause = qb.andWhere.mock.calls.find(([sql]) =>
      String(sql).includes('COALESCE'),
    )?.[0];

    // `updatedAt` would count an admin fixing a POD number as progress.
    expect(clause).toContain('bill.statusChangedAt');
    expect(clause).toContain('bill.createdAt');
    expect(clause).not.toContain('updatedAt');
  });

  it('orders by a plain column, which is all TypeORM can parse', async () => {
    await scheduler.flagStalledApplications();

    // Regression guard. `orderBy` is parsed as `alias.property`, so passing an
    // expression made the whole job throw "COALESCE(bill alias was not found"
    // at runtime — invisible to a test that only asserts the WHERE clause.
    const [column] = qb.orderBy.mock.calls[0];
    expect(column).toBe('bill.createdAt');
    expect(column).not.toContain('(');
  });

  it('gives a case three days before flagging it, on Postgres time', async () => {
    await scheduler.flagStalledApplications();

    // Same regression guard as the reminder job: the COALESCE mixes a
    // timezone-aware column with a naive one, so a JS Date would be right for
    // one branch and wrong for the other.
    expect(paramsFor(qb, 'COALESCE').days).toBe(3);
    expect(sqlFor(qb, 'COALESCE')).toContain('NOW()');
    expect(sqlFor(qb, 'COALESCE')).toContain("INTERVAL '1 day'");
  });

  it('reports the age and the newest case number', async () => {
    const stalledSince = new Date(Date.now() - 5 * DAY);
    getMany.mockResolvedValue([
      {
        id: 'b1',
        userId: 'u1',
        status: BillStatus.VERIFICATION_REVIEW,
        createdAt: new Date(Date.now() - 30 * DAY),
        statusChangedAt: stalledSince,
        switchCases: [
          { caseNumber: 'CASE-OLD', createdAt: new Date(Date.now() - 20 * DAY) },
          { caseNumber: 'CASE-NEW', createdAt: new Date(Date.now() - 6 * DAY) },
        ],
      },
    ]);

    await scheduler.flagStalledApplications();

    const [bill, since, days, caseNumber] = applicationStalled.mock.calls[0];
    expect(bill).toMatchObject({ id: 'b1', userId: 'u1' });
    expect(since).toEqual(stalledSince);
    expect(days).toBe(5);
    expect(caseNumber).toBe('CASE-NEW');
  });

  it('falls back to createdAt on rows written before the column existed', async () => {
    const created = new Date(Date.now() - 4 * DAY);
    getMany.mockResolvedValue([
      {
        id: 'b1',
        userId: 'u1',
        status: BillStatus.UPLOADED,
        createdAt: created,
        statusChangedAt: null,
        switchCases: [],
      },
    ]);

    await scheduler.flagStalledApplications();

    expect(applicationStalled.mock.calls[0][1]).toEqual(created);
    expect(applicationStalled.mock.calls[0][3]).toBeUndefined();
  });

  it('survives a database failure without throwing at the scheduler', async () => {
    getMany.mockRejectedValue(new Error('connection lost'));

    await expect(scheduler.flagStalledApplications()).resolves.toBeUndefined();
  });
});
