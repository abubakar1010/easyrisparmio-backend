import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

/**
 * Raw SQL that has to run BEFORE TypeORM synchronises the schema.
 *
 * This project has no migrations: the schema is kept by `synchronize` in dev and
 * applied by hand in production. That is fine for additive changes, but removing
 * a value from a Postgres enum is not additive — TypeORM rebuilds the type with
 * `USING "status"::text::"new_enum"`, and that cast fails outright if a single
 * row still holds the removed value. So the rows have to be moved first, which
 * `onModuleInit` cannot do: synchronisation happens while the DataSource is
 * being initialised, long before any module's lifecycle hook fires.
 *
 * Every statement here is idempotent and tolerates a database where the table,
 * column or enum value does not exist — it runs on empty databases too.
 */
const logger = new Logger('PreSyncMigrations');

async function tableExists(ds: DataSource, table: string): Promise<boolean> {
  const rows = await ds.query(
    `SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = $1`,
    [table],
  );
  return rows.length > 0;
}

async function columnExists(
  ds: DataSource,
  table: string,
  column: string,
): Promise<boolean> {
  const rows = await ds.query(
    `SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = $1 AND column_name = $2`,
    [table, column],
  );
  return rows.length > 0;
}

/**
 * Retires the four contract statuses that the external-signing flow removed.
 *
 * Comparisons go through `status::text` on purpose: once the enum type has been
 * rebuilt without these values, comparing the column to the literal
 * `'contract_signed'` is an error rather than a miss, so this would only ever
 * work on the first run.
 */
async function retireContractStatuses(ds: DataSource): Promise<void> {
  if (await tableExists(ds, 'energy_bills')) {
    // All four land on CONTRACT_SENT rather than being fanned out by how far
    // they had got. AWAITING_ACTIVATION now requires an activation and an expiry
    // date, and none of these rows has either — parking them there would
    // produce live utilities showing a blank activation date. CONTRACT_SENT
    // makes the admin move them forward and supply the dates.
    const result = await ds.query(
      `UPDATE energy_bills SET status = 'contract_sent'
        WHERE status::text IN (
          'contract_signed', 'contract_review',
          'contract_verification_required', 'contract_verified'
        )`,
    );
    const moved = result?.[1] ?? 0;
    if (moved > 0) logger.log(`Moved ${moved} bill(s) off the retired contract statuses`);
  }

  if (await tableExists(ds, 'switch_cases')) {
    const result = await ds.query(
      `UPDATE switch_cases SET status = 'contract_sent' WHERE status::text = 'contract_signed'`,
    );
    const moved = result?.[1] ?? 0;
    if (moved > 0) logger.log(`Moved ${moved} case(s) off contract_signed`);
  }

  if (await tableExists(ds, 'case_events')) {
    // `case_events` keeps a history of old/new case statuses. Rows naming a
    // retired status would block the enum rebuild just like a live case would,
    // so the audit trail is rewritten to the status that replaced it.
    await ds.query(
      `UPDATE case_events SET old_status = 'contract_sent' WHERE old_status::text = 'contract_signed'`,
    );
    await ds.query(
      `UPDATE case_events SET new_status = 'contract_sent' WHERE new_status::text = 'contract_signed'`,
    );
  }
}

/**
 * Moves the three fields worth keeping off the retired `contracts` table and
 * onto the case. The columns are added here rather than left to `synchronize`
 * so that the copy below works in production too, where nothing synchronises.
 */
async function moveContractDatesOntoCases(ds: DataSource): Promise<void> {
  if (!(await tableExists(ds, 'switch_cases'))) return;

  await ds.query(
    `ALTER TABLE switch_cases
       ADD COLUMN IF NOT EXISTS activation_date date,
       ADD COLUMN IF NOT EXISTS expiry_date date,
       ADD COLUMN IF NOT EXISTS contract_sent_at timestamptz`,
  );

  if (!(await tableExists(ds, 'contracts'))) return;

  const result = await ds.query(
    `UPDATE switch_cases sc
        SET activation_date  = COALESCE(sc.activation_date, c.activation_date),
            expiry_date      = COALESCE(sc.expiry_date, c.expiry_date),
            contract_sent_at = COALESCE(sc.contract_sent_at, c.created_at)
       FROM contracts c
      WHERE c.case_id = sc.id
        AND (sc.activation_date IS NULL OR sc.expiry_date IS NULL OR sc.contract_sent_at IS NULL)`,
  );
  const copied = result?.[1] ?? 0;
  if (copied > 0) {
    logger.log(
      `Copied contract dates onto ${copied} case(s). ` +
        `The legacy contracts tables are now unused — drop them with scripts/drop-legacy-contract-tables.sql.`,
    );
  }
}

/**
 * `matched_contract_id` pointed at a table that no longer exists. It carries no
 * foreign key, so the rename is safe — but it has to happen here, because
 * `synchronize` would see an unknown column plus a missing one and resolve that
 * by dropping and recreating, losing the values.
 */
async function renameReconciliationMatchColumn(ds: DataSource): Promise<void> {
  if (!(await tableExists(ds, 'csv_reconciliation_rows'))) return;
  if (!(await columnExists(ds, 'csv_reconciliation_rows', 'matched_contract_id'))) return;
  if (await columnExists(ds, 'csv_reconciliation_rows', 'matched_case_id')) return;

  await ds.query(
    `ALTER TABLE csv_reconciliation_rows RENAME COLUMN matched_contract_id TO matched_case_id`,
  );
  logger.log('Renamed csv_reconciliation_rows.matched_contract_id to matched_case_id');
}

/**
 * Never blocks startup: the worst case of a failure here is that synchronise
 * fails right after with a much louder message, which is the outcome we want.
 */
export async function runPreSyncMigrations(ds: DataSource): Promise<void> {
  try {
    await retireContractStatuses(ds);
    await moveContractDatesOntoCases(ds);
    await renameReconciliationMatchColumn(ds);
  } catch (error: any) {
    logger.error(`Pre-sync migration failed: ${error?.message ?? error}`);
    throw error;
  }
}
