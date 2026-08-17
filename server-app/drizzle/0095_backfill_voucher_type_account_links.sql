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
