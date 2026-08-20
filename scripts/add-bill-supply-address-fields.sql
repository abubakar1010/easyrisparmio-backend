-- Adds the five supply-address columns to `energy_bills`.
--
-- A bill's supply address used to be one free-text line, `supply_address`, as
-- OCR read it off the page. It is now stored the same way a case stores its
-- addresses — street, civic number, city, CAP and province — so the admin can
-- correct each field on its own and the address reaches the supplier in the
-- shape they expect. `supply_address` stays as the line rendered from the five,
-- which is what every read-only view still shows.
--
-- Purely additive and safe to re-run. Dev databases get these columns from
-- TypeORM's `synchronize`; production does not synchronise, so run it there:
--
--   psql "$DATABASE_URL" -f scripts/add-bill-supply-address-fields.sql
--
-- Run it BEFORE deploying the new build. The application splits the existing
-- lines into the five fields on boot (BillsService.onModuleInit), and that pass
-- needs the columns to already exist — it logs a warning and moves on if they
-- do not, leaving the split to the next restart.

ALTER TABLE energy_bills
  ADD COLUMN IF NOT EXISTS supply_street        varchar(255),
  ADD COLUMN IF NOT EXISTS supply_street_number varchar(20),
  ADD COLUMN IF NOT EXISTS supply_city          varchar(100),
  ADD COLUMN IF NOT EXISTS supply_postal_code   varchar(10),
  ADD COLUMN IF NOT EXISTS supply_province      varchar(100);

-- ── Check the backfill afterwards ──────────────────────────────────────────
--
-- After the first boot on the new build, every bill that holds an address
-- should hold it as the five fields too:
--
--   SELECT count(*) FILTER (WHERE supply_address IS NOT NULL)              AS with_line,
--          count(*) FILTER (WHERE supply_street IS NOT NULL)               AS with_street,
--          count(*) FILTER (WHERE supply_address IS NOT NULL
--                             AND supply_street IS NULL)                   AS unsplit
--     FROM energy_bills;
--
-- `unsplit` counts the lines the parser could make nothing of. Those keep the
-- line they always had and are filled in by hand from the bill editor.
