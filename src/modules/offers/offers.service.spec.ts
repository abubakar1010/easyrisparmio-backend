import { BadRequestException } from '@nestjs/common';

import { OffersService } from './offers.service';
import { Offer } from './entities/offer.entity';
import { OfferStatus } from '../../common/enums/offer-status.enum';
import { EnergyType, MarketType } from '../../common/enums/offer.enum';
import { CaseStatus } from '../../common/enums/case.enum';
import { SupplierStatus } from '../../common/enums/supplier.enum';

/**
 * Covers the two rules that decide whether a catalogue entry is still the
 * admin's to change.
 *
 * Both used to read "has anyone ever pointed a case at this offer", counting
 * cancelled and rejected ones. A customer who started a switch and backed out
 * would freeze the offer's price for good, and archiving was the only way out
 * — itself a one-way door. What actually matters is whether a switch is still
 * running against those terms, which is what these tests pin down.
 */

const OFFER_ID = '33333333-3333-4333-8333-333333333333';
const ADMIN_ID = '44444444-4444-4444-8444-444444444444';

type FakeCase = { status: CaseStatus };

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

function makeService(options: {
  offerStatus: OfferStatus;
  cases?: FakeCase[];
  supplier?: { isActive: boolean; status: SupplierStatus };
  offer?: Partial<Offer>;
}) {
  const offer = {
    id: OFFER_ID,
    name: 'Fixed 12',
    offerStatus: options.offerStatus,
    energyType: EnergyType.ELECTRICITY,
    marketType: MarketType.FIXED,
    pricePerKwh: 0.115,
    supplier: options.supplier ?? { isActive: true, status: SupplierStatus.ACTIVE },
    ...options.offer,
  } as unknown as Offer;

  const offerRepository = {
    findOne: async () => offer,
    save: async (row: Offer) => row,
  };

  const switchCaseRepository = {
    count: async ({ where }: { where: { status?: unknown } }) =>
      (options.cases ?? []).filter((c) => matches(where.status, c.status)).length,
  };

  const service = new OffersService(
    offerRepository as never,
    {} as never,
    {} as never,
    switchCaseRepository as never,
    {} as never,
  );

  return { service, offer };
}

describe('OffersService — edit lock', () => {
  it('lets an offer be edited again once its only case was cancelled', async () => {
    const { service } = makeService({
      offerStatus: OfferStatus.ACTIVE,
      cases: [{ status: CaseStatus.CANCELLED }, { status: CaseStatus.REJECTED }],
    });

    const updated = await service.update(
      OFFER_ID,
      { pricePerKwh: 0.099 } as never,
      ADMIN_ID,
    );

    expect(updated.pricePerKwh).toBe(0.099);
  });

  it('still refuses to edit an offer a live case depends on', async () => {
    const { service } = makeService({
      offerStatus: OfferStatus.ACTIVE,
      cases: [{ status: CaseStatus.CANCELLED }, { status: CaseStatus.ACTIVATED }],
    });

    await expect(
      service.update(OFFER_ID, { pricePerKwh: 0.099 } as never, ADMIN_ID),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('OffersService — un-archiving', () => {
  it('puts an archived offer back on sale', async () => {
    const { service } = makeService({ offerStatus: OfferStatus.ARCHIVED });

    const updated = await service.updateStatus(
      OFFER_ID,
      { offerStatus: OfferStatus.ACTIVE } as never,
      ADMIN_ID,
    );

    expect(updated.offerStatus).toBe(OfferStatus.ACTIVE);
  });

  it('sends an archived offer back to draft when nothing live depends on it', async () => {
    const { service } = makeService({
      offerStatus: OfferStatus.ARCHIVED,
      cases: [{ status: CaseStatus.CANCELLED }],
    });

    const updated = await service.updateStatus(
      OFFER_ID,
      { offerStatus: OfferStatus.DRAFT } as never,
      ADMIN_ID,
    );

    expect(updated.offerStatus).toBe(OfferStatus.DRAFT);
  });

  it('refuses to send an archived offer back to draft while a case is running', async () => {
    const { service } = makeService({
      offerStatus: OfferStatus.ARCHIVED,
      cases: [{ status: CaseStatus.AWAITING_ACTIVATION }],
    });

    await expect(
      service.updateStatus(OFFER_ID, { offerStatus: OfferStatus.DRAFT } as never, ADMIN_ID),
    ).rejects.toThrow(/used by an active case/);
  });

  it('refuses to republish an offer whose supplier is on the way out', async () => {
    const { service } = makeService({
      offerStatus: OfferStatus.ARCHIVED,
      supplier: { isActive: true, status: SupplierStatus.PENDING_DELETION },
    });

    await expect(
      service.updateStatus(OFFER_ID, { offerStatus: OfferStatus.ACTIVE } as never, ADMIN_ID),
    ).rejects.toThrow(/pending deletion/);
  });

  it('refuses to republish an offer whose supplier is inactive', async () => {
    const { service } = makeService({
      offerStatus: OfferStatus.ARCHIVED,
      supplier: { isActive: false, status: SupplierStatus.INACTIVE },
    });

    await expect(
      service.updateStatus(OFFER_ID, { offerStatus: OfferStatus.ACTIVE } as never, ADMIN_ID),
    ).rejects.toThrow(/inactive supplier/);
  });
});

/**
 * What the app puts at the top of "Offers for you".
 *
 * The admin arranges each bill's offers by hand in the dashboard, so the only
 * thing this list may sort by is that arrangement — a savings or price order
 * laid over it would quietly overrule them.
 */

const BILL_ONE = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const BILL_TWO = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

type FakeSentOffer = {
  offerId: string;
  billId: string;
  displayOrder: number;
  createdAt: Date;
  estimatedSavings: number;
};

function sentOffer(
  offerId: string,
  billId: string,
  displayOrder: number,
  sentAt: string,
  estimatedSavings = 0,
): FakeSentOffer {
  return {
    offerId,
    billId,
    displayOrder,
    createdAt: new Date(sentAt),
    estimatedSavings,
  };
}

/**
 * `getUserSentOffers` reads its rows through a query builder, so the fake has
 * to be chainable. Every method hands `this` back and `getMany` answers with
 * the rows the test set up.
 */
function makeServiceWithSentOffers(rows: FakeSentOffer[]) {
  const queryBuilder: Record<string, unknown> = {};
  for (const method of [
    'leftJoinAndSelect',
    'where',
    'andWhere',
    'orderBy',
    'addOrderBy',
  ]) {
    queryBuilder[method] = () => queryBuilder;
  }
  queryBuilder.getMany = async () => rows;

  const sentOfferRepository = { createQueryBuilder: () => queryBuilder };

  return new OffersService(
    {} as never,
    {} as never,
    sentOfferRepository as never,
    {} as never,
    {} as never,
  );
}

describe('OffersService.getUserSentOffers — the order the customer sees', () => {
  it('follows the admin arrangement, not the savings', async () => {
    const service = makeServiceWithSentOffers([
      sentOffer('offer-cheap', BILL_ONE, 2, '2026-08-30T10:00:00.000Z', 2222),
      sentOffer('offer-picked', BILL_ONE, 0, '2026-08-30T10:00:00.000Z', 222),
      sentOffer('offer-middle', BILL_ONE, 1, '2026-08-30T10:00:00.000Z', 12),
    ]);

    const offers = await service.getUserSentOffers('user-1');

    expect(offers.map((o) => o.offerId)).toEqual([
      'offer-picked',
      'offer-middle',
      'offer-cheap',
    ]);
  });

  it('keeps each bill together, newest batch first', async () => {
    const service = makeServiceWithSentOffers([
      sentOffer('new-second', BILL_TWO, 1, '2026-08-31T09:00:00.000Z'),
      sentOffer('old-first', BILL_ONE, 0, '2026-08-20T09:00:00.000Z'),
      sentOffer('new-first', BILL_TWO, 0, '2026-08-31T09:00:00.000Z'),
      sentOffer('old-second', BILL_ONE, 1, '2026-08-20T09:00:00.000Z'),
    ]);

    const offers = await service.getUserSentOffers('user-1');

    expect(offers.map((o) => o.offerId)).toEqual([
      'new-first',
      'new-second',
      'old-first',
      'old-second',
    ]);
  });

  /**
   * A bill topped up with a second batch is the freshest thing the customer
   * has, so it leads — but the offers already in it keep the places the admin
   * gave them rather than being pushed down by the newcomer.
   */
  it('ranks a bill by its most recent send, not its first', async () => {
    const service = makeServiceWithSentOffers([
      sentOffer('topped-up', BILL_ONE, 2, '2026-08-31T09:00:00.000Z'),
      sentOffer('other-bill', BILL_TWO, 0, '2026-08-25T09:00:00.000Z'),
      sentOffer('original', BILL_ONE, 0, '2026-08-20T09:00:00.000Z'),
      sentOffer('original-two', BILL_ONE, 1, '2026-08-20T09:00:00.000Z'),
    ]);

    const offers = await service.getUserSentOffers('user-1');

    expect(offers.map((o) => o.offerId)).toEqual([
      'original',
      'original-two',
      'topped-up',
      'other-bill',
    ]);
  });
});

/**
 * An offer has to carry a price for the way it says it is priced. Nothing
 * enforced that before: every price column is nullable and the DTO marks all
 * three optional, so an offer could be saved priced at nothing, and the
 * customer's utility details then had a blank where their energy price goes.
 *
 * These run against `update`, which is the harder half — it merges a partial
 * body into the stored row, so the rule has to be judged on the result rather
 * than on what the request happened to mention.
 */
describe('OffersService — pricing completeness', () => {
  it('refuses to leave a fixed offer with no per-unit price', async () => {
    const { service } = makeService({ offerStatus: OfferStatus.DRAFT });

    await expect(
      service.update(OFFER_ID, { pricePerKwh: null } as never, ADMIN_ID),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuses to switch an offer to indexed without giving it a spread', async () => {
    const { service } = makeService({ offerStatus: OfferStatus.DRAFT });

    await expect(
      service.update(
        OFFER_ID,
        { marketType: MarketType.INDEXED } as never,
        ADMIN_ID,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts that switch when the spread comes with it', async () => {
    const { service } = makeService({ offerStatus: OfferStatus.DRAFT });

    const updated = await service.update(
      OFFER_ID,
      { marketType: MarketType.INDEXED, spread: 0.012 } as never,
      ADMIN_ID,
    );

    expect(updated.spread).toBe(0.012);
  });

  it('takes a zero spread as a real price, not a missing one', async () => {
    const { service } = makeService({
      offerStatus: OfferStatus.DRAFT,
      offer: { marketType: MarketType.INDEXED, pricePerKwh: null as never },
    });

    const updated = await service.update(
      OFFER_ID,
      { spread: 0 } as never,
      ADMIN_ID,
    );

    expect(updated.spread).toBe(0);
  });

  it('wants a price for both commodities of a fixed dual offer', async () => {
    const { service } = makeService({
      offerStatus: OfferStatus.DRAFT,
      offer: { energyType: EnergyType.DUAL },
    });

    await expect(
      service.update(OFFER_ID, { pricePerKwh: 0.099 } as never, ADMIN_ID),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('leaves an indexed offer alone about its missing per-unit price', async () => {
    const { service } = makeService({
      offerStatus: OfferStatus.DRAFT,
      offer: {
        marketType: MarketType.VARIABLE,
        pricePerKwh: null as never,
        spread: 0.012,
      },
    });

    const updated = await service.update(
      OFFER_ID,
      { name: 'Indexed 12' } as never,
      ADMIN_ID,
    );

    expect(updated.name).toBe('Indexed 12');
  });
});
