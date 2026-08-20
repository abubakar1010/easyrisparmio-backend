-- Adds the three admin-authored content columns to `agreements`.
--
-- The mobile agreement detail screen renders a large discount figure, a
-- copyable promo code and a numbered "how to use" guide. None of the three had
-- a column: the app scraped the code out of `discount_description` with a
-- regex, used the first sentence of that same text as the headline, and
-- hardcoded the four guide steps in its translation files. The admin could not
-- author any of them, and the regex silently produced an empty code for any
-- code that did not end in digits.
--
-- All three are nullable. When they are null the app falls back to its previous
-- behaviour, so existing rows keep working until an admin fills them in.
--
-- Purely additive and safe to re-run. Dev databases get these columns from
-- TypeORM's `synchronize`; production does not synchronise, so run it there:
--
--   psql "$DATABASE_URL" -f scripts/add-agreement-content-fields.sql
--
-- Run it BEFORE deploying the new build — the API rejects unknown payload keys,
-- so the dashboard cannot save these fields until the columns exist.

ALTER TABLE agreements
  ADD COLUMN IF NOT EXISTS discount_headline varchar(60),
  ADD COLUMN IF NOT EXISTS discount_code     varchar(50),
  ADD COLUMN IF NOT EXISTS how_to_use        jsonb;
