-- Creates `supplier_faqs`: the FAQs an admin writes for one supplier.
--
-- The FAQ section of the mobile utility details used to show the generic
-- "Cambio Fornitore" category FAQs to every customer. It now shows the FAQs of
-- the supplier serving that utility, which the admin manages per supplier from
-- the supplier details page in the dashboard. The general FAQs in `faqs` are
-- untouched and still back the support screen.
--
-- Purely additive and safe to re-run. Dev databases get this table from
-- TypeORM's `synchronize`; production does not synchronise, so run it there:
--
--   psql "$DATABASE_URL" -f scripts/create-supplier-faqs-table.sql
--
-- Run it BEFORE deploying the new build — `GET meters/my-services` reads this
-- table, so the utilities list fails until it exists.

CREATE TABLE IF NOT EXISTS supplier_faqs (
  id          uuid         PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at  timestamp    NOT NULL DEFAULT now(),
  updated_at  timestamp    NOT NULL DEFAULT now(),
  supplier_id uuid         NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  question    varchar(500) NOT NULL,
  answer      text         NOT NULL,
  sort_order  integer      NOT NULL DEFAULT 0,
  is_active   boolean      NOT NULL DEFAULT true
);

CREATE INDEX IF NOT EXISTS "IDX_supplier_faqs_supplier_id_sort_order"
  ON supplier_faqs (supplier_id, sort_order);
