/**
 * Per-entity seed runner.
 *
 * Usage:  ts-node seed-single.ts <entity-name>
 *
 * Loads existing data from the database into SeedContext so that
 * dependent entities (e.g. offers → suppliers) are available even
 * when only seeding a single entity.
 */
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { createEmptyContext, SeedContext } from './seed-context';

// Entity imports for context loading
import { User } from '../../modules/users/entities/user.entity';
import { Supplier } from '../../modules/suppliers/entities/supplier.entity';
import { Offer } from '../../modules/offers/entities/offer.entity';
import { Meter } from '../../modules/meters/entities/meter.entity';
import { EnergyBill } from '../../modules/bills/entities/energy-bill.entity';
import { SwitchCase } from '../../modules/cases/entities/switch-case.entity';
import { SupportTicket } from '../../modules/support/entities/support-ticket.entity';
import { UserAddress } from '../../modules/users/entities/user-address.entity';
import { CsvReconciliation } from '../../modules/reconciliation/entities/csv-reconciliation.entity';
import { Contract } from '../../modules/contracts/entities/contract.entity';
import { UserRole } from '../../common/enums/role.enum';

// Seeder imports
import {
  seedUsers,
  seedBusinessProfiles,
  seedUserAddresses,
  seedUserPreferences,
} from './data/users.seed-data';
import { seedSuppliers } from './data/suppliers.seed-data';
import { seedOffers, seedOfferPriceVersions } from './data/offers.seed-data';
import { seedMeters } from './data/meters.seed-data';
import { seedEnergyBills, seedBillAnalyses } from './data/bills.seed-data';
import {
  seedSwitchCases,
  seedCaseDocuments,
  seedCaseEvents,
  seedContracts,
} from './data/cases.seed-data';
import {
  seedFaqs,
  seedSupportTopics,
  seedSupportTickets,
  seedTicketMessages,
} from './data/support.seed-data';
import {
  seedNotifications,
  seedPushTokens,
} from './data/notifications.seed-data';
import { seedReferrals } from './data/referrals.seed-data';
import { seedAgreements } from './data/agreements.seed-data';
import { seedStaticPages } from './data/static-pages.seed-data';
import { seedAdminSettings, seedAdminAlerts } from './data/admin.seed-data';
import {
  seedCsvReconciliations,
  seedCsvReconciliationRows,
} from './data/reconciliation.seed-data';

// ── Load existing DB data into context ─────────────────────────────

async function loadContext(ds: DataSource): Promise<SeedContext> {
  const ctx = createEmptyContext();

  const userRepo = ds.getRepository(User);
  const admin = await userRepo.findOne({ where: { role: UserRole.ADMIN } });
  if (admin) ctx.users.admin = admin;
  ctx.users.personal = await userRepo.find({
    where: { role: UserRole.PERSONAL },
  });
  ctx.users.business = await userRepo.find({
    where: { role: UserRole.BUSINESS },
  });

  ctx.suppliers = await ds.getRepository(Supplier).find({ withDeleted: true });
  ctx.offers = await ds.getRepository(Offer).find({ withDeleted: true });
  ctx.meters = await ds.getRepository(Meter).find({ withDeleted: true });
  ctx.bills = await ds.getRepository(EnergyBill).find({ withDeleted: true });
  ctx.cases = await ds.getRepository(SwitchCase).find({ withDeleted: true });
  ctx.tickets = await ds.getRepository(SupportTicket).find();
  ctx.addresses = await ds.getRepository(UserAddress).find();
  ctx.reconciliations = await ds.getRepository(CsvReconciliation).find();
  ctx.contracts = await ds.getRepository(Contract).find({ withDeleted: true });

  return ctx;
}

// ── Seeder registry ────────────────────────────────────────────────

const SEEDERS: Record<
  string,
  (ds: DataSource, ctx: SeedContext) => Promise<void>
> = {
  users: async (ds, ctx) => {
    await seedUsers(ds, ctx);
    await seedBusinessProfiles(ds, ctx);
    await seedUserAddresses(ds, ctx);
    await seedUserPreferences(ds, ctx);
  },
  suppliers: async (ds, ctx) => {
    await seedSuppliers(ds, ctx);
  },
  offers: async (ds, ctx) => {
    await seedOffers(ds, ctx);
    await seedOfferPriceVersions(ds, ctx);
  },
  meters: async (ds, ctx) => {
    await seedMeters(ds, ctx);
  },
  bills: async (ds, ctx) => {
    await seedEnergyBills(ds, ctx);
    await seedBillAnalyses(ds, ctx);
  },
  cases: async (ds, ctx) => {
    await seedSwitchCases(ds, ctx);
    await seedCaseDocuments(ds, ctx);
    await seedCaseEvents(ds, ctx);
    await seedContracts(ds, ctx);
  },
  support: async (ds, ctx) => {
    await seedSupportTopics(ds);
    await seedFaqs(ds);
    await seedSupportTickets(ds, ctx);
    await seedTicketMessages(ds, ctx);
  },
  notifications: async (ds, ctx) => {
    await seedNotifications(ds, ctx);
    await seedPushTokens(ds, ctx);
  },
  referrals: async (ds, ctx) => {
    await seedReferrals(ds, ctx);
  },
  agreements: async (ds, ctx) => {
    await seedAgreements(ds, ctx);
  },
  'static-pages': async (ds) => {
    await seedStaticPages(ds);
  },
  admin: async (ds, ctx) => {
    await seedAdminSettings(ds);
    await seedAdminAlerts(ds, ctx);
  },
  reconciliation: async (ds, ctx) => {
    await seedCsvReconciliations(ds, ctx);
    await seedCsvReconciliationRows(ds, ctx);
  },
};

// ── Main ───────────────────────────────────────────────────────────

async function run(): Promise<void> {
  const entityName = process.argv[2];

  if (!entityName || !SEEDERS[entityName]) {
    console.log('\nUsage: npm run seed:<entity-name>\n');
    console.log('Available entities:');
    Object.keys(SEEDERS).forEach((name) => console.log(`  - ${name}`));
    console.log('\nExamples:');
    console.log('  npm run seed:suppliers');
    console.log('  npm run seed:offers');
    console.log('  npm run seed:meters\n');
    process.exit(1);
  }

  process.env.SKIP_AUTO_SEED = 'true';

  console.log('\n========================================');
  console.log(`  EasyRisparmio — Seed: ${entityName}`);
  console.log('========================================\n');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const ds = app.get(DataSource);
  const ctx = await loadContext(ds);

  try {
    await SEEDERS[entityName](ds, ctx);

    console.log('\n========================================');
    console.log(`  Done — ${entityName} seeded successfully.`);
    console.log('========================================\n');
  } catch (error) {
    console.error(`\n  Seeding ${entityName} failed:`, error);
    process.exit(1);
  } finally {
    await app.close();
  }

  process.exit(0);
}

run();
