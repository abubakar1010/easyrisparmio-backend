-- Deletes the retired "Business Terms and Conditions" static page for good.
--
-- There is only one set of Terms and Conditions now, and it binds personal and
-- business accounts alike. The application no longer offers the business
-- document anywhere, and on every boot it deactivates whatever rows remain
-- (src/database/pre-sync/index.ts, retireBusinessTerms) so nothing lists it and
-- no account is held at the consent gate for it.
--
-- THIS IS DESTRUCTIVE AND IS NOT RUN AUTOMATICALLY. The deactivated rows are
-- harmless: they cost two rows and keep the text that users actually consented
-- to readable next to their consent records. Run this only if you have decided
-- you do not want that text kept.
--
--   psql "$DATABASE_URL" -f scripts/delete-business-terms-page.sql
--
-- ── Consent history ────────────────────────────────────────────────────────
--
-- `user_legal_acceptances` rows for the slug are NOT deleted below. They are
-- the record of consent a GDPR request has to be answerable from, and they
-- carry no foreign key to `static_pages`, so they survive the delete. To see
-- how many there are:
--
--   SELECT count(*) FROM user_legal_acceptances
--    WHERE slug = 'business-terms-conditions';
--
-- Erase them only in response to an actual erasure request, one user at a time:
--
--   DELETE FROM user_legal_acceptances
--    WHERE slug = 'business-terms-conditions' AND user_id = '<uuid>';
--
-- ── Check what will go ─────────────────────────────────────────────────────
--
--   SELECT id, locale, version, is_active, requires_acceptance
--     FROM static_pages WHERE slug = 'business-terms-conditions';
--
-- Every row listed should be inactive. A row still marked active means the
-- application has not booted with this change yet — deploy it first.

BEGIN;

DELETE FROM static_pages WHERE slug = 'business-terms-conditions';

COMMIT;
