-- Backfill journal-local accounting link groups for legacy flat configurations.
-- Each central voucher type gets its own copy keyed by voucherTypeId.

DO $$
DECLARE
  journal_row RECORD;
  type_row JSONB;
  config JSONB;
  links JSONB;
  links_by_type JSONB;
  type_id TEXT;
BEGIN
  FOR journal_row IN
    SELECT id, payment_types_config
    FROM document_journals
    WHERE payment_types_config IS NOT NULL
      AND jsonb_typeof(payment_types_config->'types') = 'array'
      AND jsonb_typeof(payment_types_config->'accountLinks') = 'array'
  LOOP
    config := journal_row.payment_types_config;
    links := config->'accountLinks';
    links_by_type := CASE
      WHEN jsonb_typeof(config->'accountLinksByType') = 'object'
        THEN config->'accountLinksByType'
      ELSE '{}'::JSONB
    END;

    FOR type_row IN
      SELECT value
      FROM jsonb_array_elements(config->'types')
    LOOP
      type_id := NULLIF(type_row->>'id', '');
      IF type_id IS NOT NULL AND NOT (links_by_type ? type_id) THEN
        links_by_type := jsonb_set(links_by_type, ARRAY[type_id], links, true);
      END IF;
    END LOOP;

    config := jsonb_set(config, '{accountLinksByType}', links_by_type, true);
    UPDATE document_journals
    SET payment_types_config = config
    WHERE id = journal_row.id;
  END LOOP;
END $$;

-- Every persisted voucher type and every per-type link key must resolve to a
-- central voucher type in the same organization. Fail the migration rather
-- than allowing a journal to carry an orphaned voucherTypeId.
DO $$
DECLARE
  orphan_row RECORD;
BEGIN
  FOR orphan_row IN
    SELECT
      j.id AS journal_id,
      type_row.value->>'id' AS voucher_type_id
    FROM document_journals AS j
    CROSS JOIN LATERAL jsonb_array_elements(j.payment_types_config->'types') AS type_row(value)
    LEFT JOIN document_voucher_types AS v
      ON v.org_id = j.org_id
     AND v.id = CASE
       WHEN (type_row.value->>'id') ~ '^[0-9]+$'
         THEN (type_row.value->>'id')::integer
       ELSE NULL
     END
    WHERE jsonb_typeof(j.payment_types_config->'types') = 'array'
      AND (
        COALESCE(type_row.value->>'id', '') !~ '^[0-9]+$'
        OR v.id IS NULL
      )
  LOOP
    RAISE EXCEPTION
      'orphan document voucher type % in document journal %',
      orphan_row.voucher_type_id,
      orphan_row.journal_id;
  END LOOP;

  FOR orphan_row IN
    SELECT
      j.id AS journal_id,
      link.key AS voucher_type_id
    FROM document_journals AS j
    CROSS JOIN LATERAL jsonb_object_keys(j.payment_types_config->'accountLinksByType') AS link(key)
    LEFT JOIN document_voucher_types AS v
      ON v.org_id = j.org_id
     AND v.id = CASE
       WHEN link.key ~ '^[0-9]+$'
         THEN link.key::integer
       ELSE NULL
     END
    WHERE jsonb_typeof(j.payment_types_config->'accountLinksByType') = 'object'
      AND v.id IS NULL
  LOOP
    RAISE EXCEPTION
      'orphan accounting link voucherTypeId % in document journal %',
      orphan_row.voucher_type_id,
      orphan_row.journal_id;
  END LOOP;
END $$;
