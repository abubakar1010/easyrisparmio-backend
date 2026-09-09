import { BadRequestException } from '@nestjs/common';

import { BillsService } from './bills.service';
import { BillStatus, BillType } from '../../common/enums/bill.enum';
import { CaseStatus } from '../../common/enums/case.enum';
import { EnergyType, MarketType, UserTarget } from '../../common/enums/offer.enum';
import { UserRole } from '../../common/enums/role.enum';
import { SupplierStatus } from '../../common/enums/supplier.enum';

/**
 * Covers who an offer may be sent to, and until when.
 *
 * Both rules used to live only in the dashboard: it greys out the send button
 * once a case exists, and it lists whatever offers the API returns. Neither
 * survives a request made straight to the API, which is the whole problem —
 * a bill whose customer has already signed could still be sent more offers,
 * and a private customer could be sent a tariff written for businesses.
 */

const BILL_ID = '55555555-5555-4555-8555-555555555555';
const USER_ID = '66666666-6666-4666-8666-666666666666';
const OFFER_ID = '77777777-7777-4777-8777-777777777777';

/**
 * Evaluates the `Not(In([...]))` the service builds, so the fake filters like
 * Postgres would. Nested operators are read off `child`, not `value` —
 * TypeORM's `value` getter unwraps to the innermost operand, which would make
 * `Not(In([...]))` look like a plain array and match everything.
 */
function matches(operator: unknown, value: string): boolean {
  if (!operator || typeof operator !== 'object' || !('type' in operator)) {
    return operator === value;
  }
  const op = operator as { type: string; value: unknown; child?: unknown };
  if (op.type === 'not') return !matches(op.child ?? op.value, value);
  if (op.type === 'in') return (op.value as string[]).includes(value);
  throw new Error(`Unsupported find operator in test: ${op.type}`);
}

/** A row already in `sent_offers`, as the fake repository hands it back. */
type FakeSentOffer = {
  offerId: string | null;
  displayOrder: number;
  createdAt: Date;
};

function makeService(options: {
  role?: UserRole;
  cases?: Array<{ status: CaseStatus; caseNumber: string }>;
  offerTarget?: UserTarget;
  catalogue?: Array<{ id: string; name: string }>;
  alreadySent?: FakeSentOffer[];
}) {
  const bill = {
    id: BILL_ID,
    userId: USER_ID,
    status: BillStatus.VERIFIED,
    billType: BillType.ELECTRICITY,
    consumptionKwh: 2400,
    costPerUnit: 0.14,
    fixedCharges: 12,
    user: options.role ? { id: USER_ID, role: options.role } : null,
  };

  const offer = {
    id: OFFER_ID,
    name: 'Business Fixed 12',
    supplierId: 'sup-1',
    supplier: { name: 'Acme', status: SupplierStatus.ACTIVE },
    energyType: EnergyType.ELECTRICITY,
    marketType: MarketType.FIXED,
    pricePerKwh: 0.11,
    fixedMonthlyFee: 5,
    target: options.offerTarget ?? UserTarget.BOTH,
  };

  const savedSentOffers: unknown[] = [];
  const notified: unknown[] = [];

  const billRepository = {
    findOne: async () => bill,
    save: async (row: unknown) => row,
  };

  const caseRepository = {
    findOne: async ({ where }: { where: { status?: unknown } }) =>
      (options.cases ?? []).find((c) => matches(where.status, c.status)) ?? null,
  };

  // Postgres is free to return `WHERE id IN (...)` in any order, and the
  // catalogue here is written back-to-front on purpose so a test that checks
  // the positions cannot pass by accident on insertion order.
  const catalogue = (options.catalogue ?? []).map((entry) => ({
    ...offer,
    ...entry,
  }));
  const offerRepository = {
    find: async () => (catalogue.length > 0 ? [...catalogue].reverse() : [offer]),
  };

  const sentOffers = options.alreadySent ?? [];
  const sentOfferRepository = {
    find: async () => sentOffers,
    create: (data: unknown) => data,
    save: async (rows: unknown[]) => {
      savedSentOffers.push(...rows);
      return rows;
    },
  };

  const notificationEvents = {
    offersAvailable: async (...args: unknown[]) => {
      notified.push(args);
    },
  };

  const service = new BillsService(
    billRepository as never,
    {} as never,
    {} as never,
    offerRepository as never,
    {} as never,
    sentOfferRepository as never,
    {} as never,
    caseRepository as never,
    {} as never,
    {} as never,
    notificationEvents as never,
    {} as never,
  );

  return { service, bill, savedSentOffers, notified };
}

describe('BillsService.sendOffersToUser — a bill that is already spoken for', () => {
  it('refuses to send once the customer has accepted an offer', async () => {
    const { service } = makeService({
      role: UserRole.PERSONAL,
      cases: [{ status: CaseStatus.AWAITING_ACTIVATION, caseNumber: 'CASE-0001' }],
    });

    await expect(
      service.sendOffersToUser(BILL_ID, [{ offerId: OFFER_ID }]),
    ).rejects.toThrow(/CASE-0001/);
  });

  it('names the rule rather than the bill status', async () => {
    const { service } = makeService({
      role: UserRole.PERSONAL,
      cases: [{ status: CaseStatus.CONTRACT_SENT, caseNumber: 'CASE-0002' }],
    });

    await expect(
      service.sendOffersToUser(BILL_ID, [{ offerId: OFFER_ID }]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sends again after that case was cancelled — the bill is free', async () => {
    const { service, savedSentOffers, notified } = makeService({
      role: UserRole.PERSONAL,
      cases: [
        { status: CaseStatus.CANCELLED, caseNumber: 'CASE-0003' },
        { status: CaseStatus.REJECTED, caseNumber: 'CASE-0004' },
      ],
    });

    await service.sendOffersToUser(BILL_ID, [{ offerId: OFFER_ID }]);

    expect(savedSentOffers).toHaveLength(1);
    expect(notified).toHaveLength(1);
  });
});

describe('BillsService — offer audience', () => {
  it('refuses to send a business tariff to a private customer', async () => {
    const { service } = makeService({
      role: UserRole.PERSONAL,
      offerTarget: UserTarget.BUSINESS,
    });

    await expect(
      service.sendOffersToUser(BILL_ID, [{ offerId: OFFER_ID }]),
    ).rejects.toThrow(/Business Fixed 12/);
  });

  it('refuses to send a consumer tariff to a business customer', async () => {
    const { service } = makeService({
      role: UserRole.BUSINESS,
      offerTarget: UserTarget.PERSONAL,
    });

    await expect(
      service.sendOffersToUser(BILL_ID, [{ offerId: OFFER_ID }]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sends an offer written for both audiences to either', async () => {
    const { service, savedSentOffers } = makeService({
      role: UserRole.BUSINESS,
      offerTarget: UserTarget.BOTH,
    });

    await service.sendOffersToUser(BILL_ID, [{ offerId: OFFER_ID }]);

    expect(savedSentOffers).toHaveLength(1);
  });

  it('leaves an unassociated bill alone — there is no audience to check yet', async () => {
    const { service, savedSentOffers } = makeService({
      offerTarget: UserTarget.BUSINESS,
    });

    await service.sendOffersToUser(BILL_ID, [{ offerId: OFFER_ID }]);

    expect(savedSentOffers).toHaveLength(1);
  });
});

/**
 * Which offer the customer sees first is the admin's call, not the cheapest
 * price's. These cover the two halves of that: the positions a batch of offers
 * starts with, and what a drag in the dashboard writes back.
 */

const OFFER_A = '11111111-1111-4111-8111-111111111111';
const OFFER_B = '22222222-2222-4222-8222-222222222222';
const OFFER_C = '33333333-3333-4333-8333-333333333333';

const CATALOGUE = [
  { id: OFFER_A, name: 'Sempre Zero S' },
  { id: OFFER_B, name: 'Flex Family' },
  { id: OFFER_C, name: 'Ewrw' },
];

/** A row as the fake `sent_offers` table already holds it. */
function sent(offerId: string | null, displayOrder: number, sentAt = '2026-08-30T10:00:00.000Z'): FakeSentOffer {
  return { offerId, displayOrder, createdAt: new Date(sentAt) };
}

describe('BillsService.sendOffersToUser — where a new offer lands in the list', () => {
  it('numbers a first batch in the order the admin sent it', async () => {
    const { service, savedSentOffers } = makeService({
      role: UserRole.PERSONAL,
      catalogue: CATALOGUE,
    });

    await service.sendOffersToUser(BILL_ID, [
      { offerId: OFFER_C },
      { offerId: OFFER_A },
      { offerId: OFFER_B },
    ]);

    expect(
      savedSentOffers.map((r) => (r as { offerId: string }).offerId),
    ).toEqual([OFFER_C, OFFER_A, OFFER_B]);
    expect(
      savedSentOffers.map((r) => (r as { displayOrder: number }).displayOrder),
    ).toEqual([0, 1, 2]);
  });

  it('appends a later batch instead of reshuffling the first', async () => {
    const { service, savedSentOffers } = makeService({
      role: UserRole.PERSONAL,
      catalogue: CATALOGUE,
      alreadySent: [sent(OFFER_A, 0), sent(OFFER_B, 1)],
    });

    await service.sendOffersToUser(BILL_ID, [
      { offerId: OFFER_A },
      { offerId: OFFER_B },
      { offerId: OFFER_C },
    ]);

    expect(savedSentOffers).toHaveLength(1);
    expect(savedSentOffers[0]).toMatchObject({ offerId: OFFER_C, displayOrder: 2 });
  });
});

describe('BillsService.reorderSentOffers', () => {
  it('rewrites the run dense from zero, top of the list first', async () => {
    const { service, savedSentOffers } = makeService({
      alreadySent: [sent(OFFER_A, 0), sent(OFFER_B, 1), sent(OFFER_C, 2)],
    });

    await service.reorderSentOffers(BILL_ID, [OFFER_C, OFFER_A, OFFER_B]);

    expect(
      savedSentOffers.map((r) => {
        const row = r as FakeSentOffer;
        return [row.offerId, row.displayOrder];
      }),
    ).toEqual([
      [OFFER_C, 0],
      [OFFER_A, 1],
      [OFFER_B, 2],
    ]);
  });

  it('refuses an offer that was never sent for this bill', async () => {
    const { service } = makeService({ alreadySent: [sent(OFFER_A, 0)] });

    await expect(
      service.reorderSentOffers(BILL_ID, [OFFER_A, OFFER_B]),
    ).rejects.toThrow(new RegExp(OFFER_B));
  });

  it('refuses a list that names the same offer twice', async () => {
    const { service } = makeService({
      alreadySent: [sent(OFFER_A, 0), sent(OFFER_B, 1)],
    });

    await expect(
      service.reorderSentOffers(BILL_ID, [OFFER_A, OFFER_A]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses to order a bill whose offers have not been sent yet', async () => {
    const { service } = makeService({});

    await expect(
      service.reorderSentOffers(BILL_ID, [OFFER_A]),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  /**
   * An offer whose catalogue entry was deleted outright leaves a row the
   * dashboard cannot draw, so the admin's list can never name it. Blocking the
   * reorder on that would strand the offers they *can* see; it trails the run
   * instead, and the positions stay dense either way.
   */
  it('keeps a row the dashboard cannot show, behind the ones it can', async () => {
    const { service, savedSentOffers } = makeService({
      alreadySent: [sent(OFFER_A, 0), sent(null, 1), sent(OFFER_B, 2)],
    });

    await service.reorderSentOffers(BILL_ID, [OFFER_B, OFFER_A]);

    expect(
      savedSentOffers.map((r) => {
        const row = r as FakeSentOffer;
        return [row.offerId, row.displayOrder];
      }),
    ).toEqual([
      [OFFER_B, 0],
      [OFFER_A, 1],
      [null, 2],
    ]);
  });
});
