-- Retires the contract tables, which nothing reads any more.
--
-- Contract signing moved outside the application: the admin hands the contract
-- over (bill status `contract_sent`), the customer signs with the supplier, and
-- the admin then moves the case to "In Attivazione" with an activation and an
-- expiry date. Both dates now live on `switch_cases`, so `contracts` and
-- `contract_documents` hold nothing the application needs.
--
-- THIS IS DESTRUCTIVE AND IS NOT RUN AUTOMATICALLY. The application copies the
-- dates across on every boot (src/database/pre-sync/index.ts) and then leaves
-- the old tables alone; run this by hand once you have confirmed the copy.
--
--   psql "$DATABASE_URL" -f scripts/drop-legacy-contract-tables.sql
--
-- ── Confirm the copy landed before running anything below ──────────────────
--
--   SELECT count(*) AS contracts_with_dates
--     FROM contracts WHERE activation_date IS NOT NULL;
--
--   SELECT count(*) AS cases_with_dates
--     FROM switch_cases WHERE activation_date IS NOT NULL;
--
-- The second count should be at least the first. If it is lower, find the gap
-- before dropping anything:
--
--   SELECT c.id, c.contract_number, c.case_id
--     FROM contracts c
--     JOIN switch_cases sc ON sc.id = c.case_id
--    WHERE c.activation_date IS NOT NULL AND sc.activation_date IS NULL;

BEGIN;

DROP TABLE IF EXISTS contract_documents;

-- Takes the unique index on contract_number and the
-- case_id -> switch_cases.id ON DELETE CASCADE foreign key with it.
DROP TABLE IF EXISTS contracts;

DROP TYPE IF EXISTS contract_documents_document_type_enum;
DROP TYPE IF EXISTS contracts_status_enum;
DROP TYPE IF EXISTS contracts_delivery_method_enum;

COMMIT;
