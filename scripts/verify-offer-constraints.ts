/**
 * Integration check for the offer constraint rules, against a real Postgres.
 *
 * The unit specs mock the repository layer, so they prove the branching but
 * never execute a line of SQL. These rules are mostly *expressed* in SQL — a
 * `NOT IN (:...closed)`, a `deletedAt IS NULL`, a target filter — so they are
 * exactly the kind of change unit tests cannot vouch for.
 *
 * Runs against a throwaway database it creates and drops, so the dev database
 * is never touched:
 *
 *   npx ts-node --project tsconfig.seed.json scripts/verify-offer-constraints.ts
 */
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { Client } from 'pg';
import { join } from 'path';

import { OffersService } from '../src/modules/offers/offers.service';
import { BillsService } from '../src/modules/bills/bills.service';
import { Offer } from '../src/modules/offers/entities/offer.entity';
import { SentOffer } from '../src/modules/offers/entities/sent-offer.entity';
import { Supplier } from '../src/modules/suppliers/entities/supplier.entity';
import { User } from '../src/modules/users/entities/user.entity';
import { EnergyBill } from '../src/modules/bills/entities/energy-bill.entity';
import { SwitchCase } from '../src/modules/cases/entities/switch-case.entity';
import { BillFile } from '../src/modules/bills/entities/bill-file.entity';
import { BillNote } from '../src/modules/bills/entities/bill-note.entity';
import { BillVerification } from '../src/modules/bills/entities/bill-verification.entity';
import { CaseEvent } from '../src/modules/cases/entities/case-event.entity';

import { UserRole } from '../src/common/enums/role.enum';
import { BillStatus, BillType } from '../src/common/enums/bill.enum';
import { CaseStatus } from '../src/common/enums/case.enum';
import { OfferStatus } from '../src/common/enums/offer-status.enum';
import { SupplierStatus } from '../src/common/enums/supplier.enum';
import { EnergyType, MarketType, UserTarget } from '../src/common/enums/offer.enum';

const ADMIN_HOST = 'postgresql://postgres:postgres@localhost:5433/postgres';
const VERIFY_DB = 'easyresparmio_shipverify';
const VERIFY_URL = `postgresql://postgres:postgres@localhost:5433/${VERIFY_DB}`;

const results: Array<{ name: string; ok: boolean; detail: string }> = [];

async function check(name: string, fn: () => Promise<string>) {
  try {
    results.push({ name, ok: true, detail: await fn() });
  } catch (error: any) {
    results.push({ name, ok: false, detail: error?.message ?? String(error) });
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

/** Runs `fn` and returns the error message it threw, failing if it resolved. */
async function rejects(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
  } catch (error: any) {
    return error?.message ?? String(error);
  }
  throw new Error('expected a rejection, but the call resolved');
}

async function recreateDatabase() {
  const admin = new Client({ connectionString: ADMIN_HOST });
  await admin.connect();
  await admin.query(`DROP DATABASE IF EXISTS ${VERIFY_DB}`);
  await admin.query(`CREATE DATABASE ${VERIFY_DB}`);
  await admin.end();
}

async function dropDatabase() {
  const admin = new Client({ connectionString: ADMIN_HOST });
  await admin.connect();
  await admin.query(
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1`,
    [VERIFY_DB],
  );
  await admin.query(`DROP DATABASE IF EXISTS ${VERIFY_DB}`);
  await admin.end();
}

async function main() {
  await recreateDatabase();

  const dataSource = new DataSource({
    type: 'postgres',
    url: VERIFY_URL,
    entities: [join(__dirname, '..', 'src', '**', '*.entity.ts')],
    synchronize: true,
    logging: false,
  });
  await dataSource.initialize();
  console.log('schema synchronised into', VERIFY_DB);

  const repo = (e: any) => dataSource.getRepository(e);

  const offers = new OffersService(
    repo(Offer) as never,
    repo(EnergyBill) as never,
    repo(SentOffer) as never,
    repo(SwitchCase) as never,
    repo(Supplier) as never,
  );

  const notified: unknown[] = [];
  const bills = new BillsService(
    repo(EnergyBill) as never,
    repo(BillFile) as never,
    repo(BillVerification) as never,
    repo(Offer) as never,
    repo(Supplier) as never,
    repo(SentOffer) as never,
    repo(User) as never,
    repo(SwitchCase) as never,
    repo(CaseEvent) as never,
    repo(BillNote) as never,
    { offersAvailable: async (...a: unknown[]) => void notified.push(a) } as never,
    {} as never,
  );

  // ─── Fixtures ────────────────────────────────────────────
  const supplierRepo = dataSource.getRepository(Supplier);
  const goodSupplier = await supplierRepo.save(
    supplierRepo.create({ name: 'Verify Energia', isActive: true, status: SupplierStatus.ACTIVE }),
  );
  const dyingSupplier = await supplierRepo.save(
    supplierRepo.create({
      name: 'Verify Uscente',
      isActive: true,
      status: SupplierStatus.PENDING_DELETION,
    }),
  );

  const userRepo = dataSource.getRepository(User);
  const personal = await userRepo.save(
    userRepo.create({
      email: 'personal@verify.test',
      firstName: 'Pia',
      lastName: 'Rossi',
      role: UserRole.PERSONAL,
    }),
  );
  const business = await userRepo.save(
    userRepo.create({
      email: 'business@verify.test',
      firstName: 'Bruno',
      lastName: 'Bianchi',
      role: UserRole.BUSINESS,
    }),
  );

  const offerRepo = dataSource.getRepository(Offer);
  const newOffer = (over: Partial<Offer>) =>
    offerRepo.save(
      offerRepo.create({
        name: 'Verify Offer',
        energyType: EnergyType.ELECTRICITY,
        marketType: MarketType.FIXED,
        contractDurationDays: 365,
        validFrom: '2026-01-01',
        supplierId: goodSupplier.id,
        offerStatus: OfferStatus.ACTIVE,
        isActive: true,
        pricePerKwh: 0.11,
        target: UserTarget.BOTH,
        ...over,
      } as Partial<Offer>),
    );

  const offerBoth = await newOffer({ name: 'Both Audiences' });
  const offerBusinessOnly = await newOffer({
    name: 'Business Only',
    target: UserTarget.BUSINESS,
  });
  const offerCancelledCase = await newOffer({ name: 'Had A Cancelled Case' });
  const offerLiveCase = await newOffer({ name: 'Has A Live Case' });
  const offerDeletedCase = await newOffer({ name: 'Had A Deleted Case' });
  const offerArchived = await newOffer({
    name: 'Archived',
    offerStatus: OfferStatus.ARCHIVED,
  });
  const offerArchivedDyingSupplier = await newOffer({
    name: 'Archived, Dead Supplier',
    offerStatus: OfferStatus.ARCHIVED,
    supplierId: dyingSupplier.id,
  });

  const billRepo = dataSource.getRepository(EnergyBill);
  const newBill = (userId: string) =>
    billRepo.save(
      billRepo.create({
        userId,
        billType: BillType.ELECTRICITY,
        status: BillStatus.VERIFIED,
        consumptionKwh: 2400,
        costPerUnit: 0.14,
        fixedCharges: 12,
      } as Partial<EnergyBill>),
    );

  const personalBill = await newBill(personal.id);
  const businessBill = await newBill(business.id);
  const billWithLiveCase = await newBill(personal.id);
  const billWithCancelledCase = await newBill(personal.id);

  const caseRepo = dataSource.getRepository(SwitchCase);
  const newCase = (over: Partial<SwitchCase>) =>
    caseRepo.save(caseRepo.create(over as Partial<SwitchCase>));

  await newCase({
    userId: personal.id,
    billId: personalBill.id,
    selectedOfferId: offerCancelledCase.id,
    status: CaseStatus.CANCELLED,
    caseNumber: 'VER-0001',
  });
  await newCase({
    userId: personal.id,
    billId: billWithLiveCase.id,
    selectedOfferId: offerLiveCase.id,
    status: CaseStatus.AWAITING_ACTIVATION,
    caseNumber: 'VER-0002',
  });
  const deletedCase = await newCase({
    userId: personal.id,
    billId: personalBill.id,
    selectedOfferId: offerDeletedCase.id,
    status: CaseStatus.ACTIVATED,
    caseNumber: 'VER-0003',
  });
  await caseRepo.softRemove(deletedCase);
  await newCase({
    userId: personal.id,
    billId: billWithCancelledCase.id,
    selectedOfferId: offerBoth.id,
    status: CaseStatus.CANCELLED,
    caseNumber: 'VER-0004',
  });

  // ─── 1. hasAcceptedCases: the query that unit tests cannot reach ──
  await check('findAllAdmin flags only offers a live case depends on', async () => {
    const page: any = await offers.findAllAdmin({ page: 1, limit: 100 } as never);
    const flag = (id: string) =>
      (page.data.find((o: any) => o.id === id) as any).hasAcceptedCases;

    assert(flag(offerLiveCase.id) === true, 'live case should flag the offer');
    assert(flag(offerCancelledCase.id) === false, 'cancelled case must not flag the offer');
    assert(flag(offerDeletedCase.id) === false, 'soft-deleted case must not flag the offer');
    assert(flag(offerBoth.id) === false, 'cancelled case must not flag the offer');
    return 'live=true, cancelled=false, soft-deleted=false';
  });

  // ─── 2. Edit lock ────────────────────────────────────────
  await check('an offer whose only case was cancelled is editable again', async () => {
    const updated = await offers.update(
      offerCancelledCase.id,
      { pricePerKwh: 0.099 } as never,
      personal.id,
    );
    assert(Number(updated.pricePerKwh) === 0.099, 'price should have been written');
    return 'price updated to 0.099';
  });

  await check('an offer with a live case is still frozen', async () =>
    rejects(() =>
      offers.update(offerLiveCase.id, { pricePerKwh: 0.099 } as never, personal.id),
    ),
  );

  await check('an offer whose case was soft-deleted is editable again', async () => {
    await offers.update(offerDeletedCase.id, { pricePerKwh: 0.098 } as never, personal.id);
    return 'price updated to 0.098';
  });

  // ─── 3. Un-archiving ─────────────────────────────────────
  await check('an archived offer can be restored to active', async () => {
    const restored = await offers.updateStatus(
      offerArchived.id,
      { offerStatus: OfferStatus.ACTIVE } as never,
      personal.id,
    );
    assert(restored.offerStatus === OfferStatus.ACTIVE, 'should be active');
    return 'archived -> active';
  });

  await check('an archived offer can go back to draft', async () => {
    await offers.updateStatus(
      offerArchived.id,
      { offerStatus: OfferStatus.ARCHIVED } as never,
      personal.id,
    );
    const drafted = await offers.updateStatus(
      offerArchived.id,
      { offerStatus: OfferStatus.DRAFT } as never,
      personal.id,
    );
    assert(drafted.offerStatus === OfferStatus.DRAFT, 'should be draft');
    return 'archived -> draft';
  });

  await check('restoring an offer on a dying supplier is refused', async () =>
    rejects(() =>
      offers.updateStatus(
        offerArchivedDyingSupplier.id,
        { offerStatus: OfferStatus.ACTIVE } as never,
        personal.id,
      ),
    ),
  );

  // ─── 4. Target filter ────────────────────────────────────
  await check('the admin offer list for a personal bill hides business offers', async () => {
    const list = await bills.getAllOffersForBill(personalBill.id);
    const ids = list.map((o: any) => o.id);
    assert(ids.includes(offerBoth.id), 'a "both" offer should be listed');
    assert(!ids.includes(offerBusinessOnly.id), 'a business offer must not be listed');
    return `${list.length} offers, business-only excluded`;
  });

  await check('the admin offer list for a business bill shows business offers', async () => {
    const list = await bills.getAllOffersForBill(businessBill.id);
    const ids = list.map((o: any) => o.id);
    assert(ids.includes(offerBusinessOnly.id), 'a business offer should be listed');
    return 'business offer listed';
  });

  await check('recommended offers obey the same audience rule', async () => {
    const list = await offers.getRecommendedOffers(personalBill.id, personal.id);
    const ids = list.map((o) => o.id);
    assert(!ids.includes(offerBusinessOnly.id), 'a business offer must not be recommended');
    return `${list.length} offers, business-only excluded`;
  });

  // ─── 5. Send guards ──────────────────────────────────────
  await check('sending a business offer to a personal customer is refused', async () =>
    rejects(() => bills.sendOffersToUser(personalBill.id, [{ offerId: offerBusinessOnly.id }])),
  );

  await check('sending onto a bill with a live case is refused', async () =>
    rejects(() => bills.sendOffersToUser(billWithLiveCase.id, [{ offerId: offerBoth.id }])),
  );

  await check('sending onto a bill whose case was cancelled succeeds', async () => {
    await bills.sendOffersToUser(billWithCancelledCase.id, [{ offerId: offerBoth.id }]);
    const sent = await dataSource
      .getRepository(SentOffer)
      .count({ where: { billId: billWithCancelledCase.id } });
    assert(sent === 1, `expected 1 sent offer, got ${sent}`);
    return '1 sent offer written, notification fired';
  });

  await dataSource.destroy();
  await dropDatabase();

  // ─── Report ──────────────────────────────────────────────
  console.log('');
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}\n        ${r.detail}`);
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
}

main().catch(async (error) => {
  console.error('verification aborted:', error);
  await dropDatabase().catch(() => undefined);
  process.exit(1);
});
