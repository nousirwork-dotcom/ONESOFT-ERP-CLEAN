-- TrustedClock v2 checkpoint parity.
-- Additive only: existing invoices and ZATCA chain values are not rewritten.
ALTER TABLE "zatca_clock_states"
  ADD COLUMN IF NOT EXISTS "last_pih" varchar(256);