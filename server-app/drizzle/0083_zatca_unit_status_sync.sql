-- Keep the legacy unit status projection truthful without touching any
-- device, certificate, CSID, fixture, compliance-test, or queue records.
UPDATE "zatca_pos_units" AS u
SET
  "status" = CASE
    WHEN EXISTS (
      SELECT 1
      FROM "document_journals" AS j
      WHERE j."org_id" = u."org_id"
        AND j."zatca_pos_unit_id" = u."id"
        AND j."is_active" = TRUE
    ) THEN 'linked'
    ELSE 'unlinked'
  END,
  "updated_at" = NOW()
WHERE u."is_deleted" = FALSE;

COMMENT ON COLUMN "zatca_pos_units"."status" IS
  'Legacy compatibility projection only: linked when an active document_journals.zatca_pos_unit_id exists; journal relationship is the source of truth.';