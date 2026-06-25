import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../../app.module';
import { createEmptyContext } from './seed-context';

// Data seeders - Level 0
import { seedUsers } from './data/users.seed-data';
import { seedSuppliers } from './data/suppliers.seed-data';
import { seedMarketIndices } from './data/market-data.seed-data';
import { seedFaqs } from './data/support.seed-data';
import { seedAdminSettings } from './data/admin.seed-data';

// Data seeders - Level 1
import {
  seedBusinessProfiles,
  seedUserAddresses,
  seedUserPreferences,
} from './data/users.seed-data';
import { seedOffers } from './data/offers.seed-data';
import { seedMeters } from './data/meters.seed-data';
import { seedCommissionRules } from './data/commissions.seed-data';
import { seedReferrals } from './data/referrals.seed-data';
import { seedAgreements } from './data/agreements.seed-data';
import { seedNotifications, seedPushTokens } from './data/notifications.seed-data';

// Data seeders - Level 2
import { seedEnergyBills } from './data/bills.seed-data';
import { seedOfferPriceVersions } from './data/offers.seed-data';
import { seedSupportTickets } from './data/support.seed-data';
import { seedCommissionTiers } from './data/commissions.seed-data';

// Data seeders - Level 3
import { seedBillAnalyses } from './data/bills.seed-data';
import { seedSwitchCases } from './data/cases.seed-data';
import { seedTicketMessages } from './data/support.seed-data';

// Data seeders - Level 4
import {
  seedCaseDocuments,
  seedCaseEvents,
  seedContracts,
} from './data/cases.seed-data';
import { seedCommissions } from './data/commissions.seed-data';

// Data seeders - Level 5
import { seedAdminAlerts } from './data/admin.seed-data';
import {
  seedCsvReconciliations,
  seedCsvReconciliationRows,
} from './data/reconciliation.seed-data';

const TABLES_IN_REVERSE_ORDER = [
  'csv_reconciliation_rows',
  'csv_reconciliations',
  'admin_alerts',
  'commissions',
  'contracts',
  'case_events',
  'case_documents',
  'ticket_messages',
  'switch_cases',
  'bill_analyses',
  'commission_tiers',
  'support_tickets',
  'offer_price_versions',
  'energy_bills',
  'push_tokens',
  'notifications',
  'agreements',
  'referrals',
  'commission_rules',
  'meters',
  'offers',
  'user_preferences',
  'user_addresses',
  'business_profiles',
  'admin_settings',
  'faqs',
  'market_indices',
  'otp_codes',
  'refresh_tokens',
  'activity_logs',
  'suppliers',
  'users',
];

async function clearAll(ds: DataSource): Promise<void> {
  console.log('\n--- Clearing all seed data ---\n');
  const queryRunner = ds.createQueryRunner();
  try {
    await queryRunner.query('SET session_replication_role = replica;');
    for (const table of TABLES_IN_REVERSE_ORDER) {
      try {
        await queryRunner.query(`TRUNCATE TABLE "${table}" CASCADE`);
        console.log(`  Truncated: ${table}`);
      } catch (err: any) {
        // Table might not exist yet if schema hasn't synced
        if (err.code === '42P01') {
          console.log(`  Skipped (not found): ${table}`);
        } else {
          throw err;
        }
      }
    }
    await queryRunner.query('SET session_replication_role = DEFAULT;');
    console.log('\n  All tables cleared.\n');
  } finally {
    await queryRunner.release();
  }
}

async function run(): Promise<void> {
  const isReset = process.argv.includes('--reset');

  // Prevent AdminSeederService from running during seed
  process.env.SKIP_AUTO_SEED = 'true';

  console.log('\n========================================');
  console.log('  EasyRisparmio Database Seeder');
  console.log(`  Mode: ${isReset ? 'RESET (clear + seed)' : 'SEED (idempotent)'}`);
  console.log('========================================\n');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const ds = app.get(DataSource);
  const ctx = createEmptyContext();

  try {
    if (isReset) {
      await clearAll(ds);
    }

    // ---- Level 0: No dependencies ----
    console.log('--- Level 0: Users, Suppliers, MarketIndex, FAQ, AdminSettings ---\n');
    await seedUsers(ds, ctx);
    await seedSuppliers(ds, ctx);
    await seedMarketIndices(ds);
    await seedFaqs(ds);
    await seedAdminSettings(ds);

    // ---- Level 1: Depend on Level 0 ----
    console.log('\n--- Level 1: Profiles, Addresses, Preferences, Offers, Meters, etc. ---\n');
    await seedBusinessProfiles(ds, ctx);
    await seedUserAddresses(ds, ctx);
    await seedUserPreferences(ds, ctx);
    await seedOffers(ds, ctx);
    await seedMeters(ds, ctx);
    await seedCommissionRules(ds, ctx);
    await seedReferrals(ds, ctx);
    await seedAgreements(ds, ctx);
    await seedNotifications(ds, ctx);
    await seedPushTokens(ds, ctx);

    // ---- Level 2: Depend on Level 1 ----
    console.log('\n--- Level 2: Bills, PriceVersions, Tickets, CommissionTiers ---\n');
    await seedEnergyBills(ds, ctx);
    await seedOfferPriceVersions(ds, ctx);
    await seedSupportTickets(ds, ctx);
    await seedCommissionTiers(ds, ctx);

    // ---- Level 3: Depend on Level 2 ----
    console.log('\n--- Level 3: BillAnalyses, SwitchCases, TicketMessages ---\n');
    await seedBillAnalyses(ds, ctx);
    await seedSwitchCases(ds, ctx);
    await seedTicketMessages(ds, ctx);

    // ---- Level 4: Depend on Level 3 ----
    console.log('\n--- Level 4: Documents, Events, Contracts, Commissions ---\n');
    await seedCaseDocuments(ds, ctx);
    await seedCaseEvents(ds, ctx);
    await seedContracts(ds, ctx);
    await seedCommissions(ds, ctx);

    // ---- Level 5: Depend on Level 4 ----
    console.log('\n--- Level 5: Alerts, Reconciliation ---\n');
    await seedAdminAlerts(ds, ctx);
    await seedCsvReconciliations(ds, ctx);
    await seedCsvReconciliationRows(ds, ctx);

    console.log('\n========================================');
    console.log('  Seeding complete!');
    console.log('========================================\n');
  } catch (error) {
    console.error('\n  Seeding failed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }

  process.exit(0);
}

run();
