-- Drops the retired `business_profiles.sdi_code` column.
--
-- The Codice Destinatario (SDI recipient code) is no longer collected, stored
-- or shown anywhere: not on registration, not on the admin customer form, not
-- on the mobile profile screen, and not on the case detail a supplier is sent.
-- The PEC is the only invoice address the platform keeps for a company.
--
-- The column is gone from `BusinessProfile`, so in development `synchronize`
-- removes it on the next boot by itself. Outside development nothing
-- synchronises and the column stays behind as an unread nullable varchar.
--
-- THIS IS DESTRUCTIVE AND IS NOT RUN AUTOMATICALLY. Nothing reads the column,
-- so leaving it in place costs nothing but the disk it sits on. Run this only
-- once you have decided the stored codes are not worth keeping.
--
--   psql "$DATABASE_URL" -f scripts/drop-business-sdi-code.sql
--
-- ── Check what will go ─────────────────────────────────────────────────────
--
--   SELECT count(*) FILTER (WHERE sdi_code IS NOT NULL) AS with_code,
--          count(*) AS total
--     FROM business_profiles;
--
-- Keep a copy first if the codes might be wanted back:
--
--   \copy (SELECT user_id, sdi_code FROM business_profiles
--           WHERE sdi_code IS NOT NULL) TO 'sdi_codes_backup.csv' CSV HEADER

BEGIN;

ALTER TABLE business_profiles DROP COLUMN IF EXISTS sdi_code;

COMMIT;
