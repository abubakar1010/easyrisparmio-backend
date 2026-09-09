/**
 * Fills the free-text `description` on suppliers that have none.
 *
 *   npm run backfill:supplier-descriptions
 *   npm run backfill:supplier-descriptions -- --dry-run
 *
 * `description` is what the mobile app renders as the "About <supplier>"
 * section on the supply details screen, above the FAQs. The section is hidden
 * when the field is null or blank, so a supplier created through the admin
 * panel before the field existed shows no section at all — which is what this
 * script repairs.
 *
 * It only ever writes over a null or whitespace-only value. A description an
 * admin actually wrote is left alone, so the script is safe to re-run and safe
 * to run after the admin panel has been used.
 */
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { Supplier } from '../modules/suppliers/entities/supplier.entity';

/**
 * Real company copy, keyed by the brand token the supplier is matched on.
 *
 * Matching is a prefix test against the supplier's brand name and its legal
 * name, both normalised, rather than an exact-equals on either. Suppliers
 * entered by hand carry typos and duplicated records ("DUFERCO" alongside
 * "DUFERCOddd"), and a prefix test still recognises those as the same company
 * instead of skipping them.
 *
 * Every entry is sourced from the supplier's own published company profile —
 * see the citation on each. Do not add an entry that is not.
 */
const REAL_SUPPLIER_DESCRIPTIONS: { key: string; description: string }[] = [
  {
    // Duferco Energia S.p.A. — dufercoenergia.com company profile:
    // founded 19 May 2010 in Genoa to sell the group's own photovoltaic and
    // hydroelectric output, since extended to retail electricity and gas
    // nationwide; over 650,000 active supply points; 400+ staff in Italy.
    key: 'duferco',
    description:
      'Società del Gruppo Duferco che dal 2010 vende energia elettrica e gas ' +
      'nel mercato libero, con sede legale a Genova. Serve oltre 650.000 punti ' +
      'di fornitura in tutta Italia tra clienti domestici, condomini e imprese, ' +
      'e produce energia da impianti fotovoltaici e idroelettrici di proprietà.',
  },
];

/** Lower-cases and collapses whitespace so "S.p.A" and "S.P.A." both match. */
function normalise(value: string | null): string {
  return (value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function descriptionFor(supplier: Supplier): string | null {
  const name = normalise(supplier.name);
  const legalName = normalise(supplier.legalName);

  const match = REAL_SUPPLIER_DESCRIPTIONS.find(
    (entry) => name.startsWith(entry.key) || legalName.startsWith(entry.key),
  );

  return match ? match.description : null;
}

async function run(): Promise<void> {
  process.env.SKIP_AUTO_SEED = 'true';

  const dryRun = process.argv.includes('--dry-run');

  console.log('\n========================================');
  console.log('  Backfill — Supplier Descriptions');
  if (dryRun) console.log('  (dry run — nothing will be written)');
  console.log('========================================\n');

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  const ds = app.get(DataSource);
  const repo = ds.getRepository(Supplier);

  try {
    // Soft-deleted suppliers are included: a deleted supplier can still be the
    // one behind a live case, and the details screen reads through the offer,
    // not through the supplier's own deleted flag.
    const suppliers = await repo.find({ withDeleted: true });

    // A blank string hides the section exactly as a null does, so both count
    // as missing. TypeORM cannot express "null or blank" in one `where`, so
    // the filter is applied here rather than in the query.
    const missing = suppliers.filter((s) => !(s.description || '').trim());

    console.log(`  ${suppliers.length} suppliers, ${missing.length} without a description.\n`);

    let filled = 0;
    const unmatched: string[] = [];

    for (const supplier of missing) {
      const description = descriptionFor(supplier);

      if (!description) {
        unmatched.push(supplier.name);
        continue;
      }

      if (!dryRun) {
        supplier.description = description;
        await repo.save(supplier);
      }

      filled += 1;
      console.log(`  ${dryRun ? 'Would fill' : 'Filled'}: ${supplier.name}`);
    }

    console.log(`\n  ${filled} filled, ${unmatched.length} with no entry to fill from.`);

    if (unmatched.length) {
      console.log(
        '\n  No company copy on file for: ' +
          unmatched.join(', ') +
          '\n  Add a sourced entry to REAL_SUPPLIER_DESCRIPTIONS, or write the' +
          '\n  description in the admin panel under "About Supplier".',
      );
    }

    console.log('');
  } catch (error) {
    console.error('\n  Backfill failed:', error);
    await app.close();
    process.exit(1);
  }

  await app.close();
  process.exit(0);
}

void run();
