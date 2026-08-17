-- Centralize document voucher types per organization.
-- Existing paymentTypesConfig JSON remains journal-owned for accounting links;
-- its type IDs are rewritten to the central voucher type IDs below.

CREATE TABLE IF NOT EXISTS "document_voucher_types" (
  "id" serial PRIMARY KEY,
  "org_id" integer NOT NULL REFERENCES "organizations"("id") ON DELETE CASCADE,
  "name_ar" varchar(255) NOT NULL DEFAULT '',
  "name_en" varchar(255) NOT NULL DEFAULT '',
  "code_ar" varchar(100) NOT NULL DEFAULT '',
  "code_en" varchar(100) NOT NULL DEFAULT '',
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "document_voucher_types_org_code_ar_uidx"
  ON "document_voucher_types" ("org_id", btrim("code_ar"))
  WHERE btrim("code_ar") <> '';

CREATE UNIQUE INDEX IF NOT EXISTS "document_voucher_types_org_code_en_ci_uidx"
  ON "document_voucher_types" ("org_id", lower(btrim("code_en")))
  WHERE btrim("code_en") <> '';

DO $$
DECLARE
  journal_row RECORD;
  type_row JSONB;
  config JSONB;
  new_types JSONB;
  new_links JSONB;
  old_links JSONB;
  old_id TEXT;
  code_ar_value TEXT;
  code_en_value TEXT;
  name_ar_value TEXT;
  name_en_value TEXT;
  voucher_type_id INTEGER;
  mapped_type JSONB;
BEGIN
  FOR journal_row IN
    SELECT id, org_id, payment_types_config
    FROM document_journals
    WHERE payment_types_config IS NOT NULL
      AND jsonb_typeof(payment_types_config->'types') = 'array'
  LOOP
    config := journal_row.payment_types_config;
    new_types := '[]'::JSONB;
    new_links := '{}'::JSONB;

    FOR type_row IN
      SELECT value
      FROM jsonb_array_elements(config->'types')
    LOOP
      old_id := COALESCE(type_row->>'id', '');
      code_ar_value := btrim(COALESCE(type_row->>'codeAr', ''));
      code_en_value := btrim(COALESCE(type_row->>'codeEn', ''));
      name_ar_value := COALESCE(type_row->>'nameAr', '');
      name_en_value := COALESCE(type_row->>'nameEn', '');
      voucher_type_id := NULL;

      -- A database that already ran the former Golden 0094 migration has
      -- numeric central IDs persisted in the journal JSON. Preserve that
      -- identity first, including types whose codes are intentionally blank.
      IF old_id ~ '^[0-9]+$' THEN
        SELECT id INTO voucher_type_id
        FROM document_voucher_types
        WHERE org_id = journal_row.org_id
          AND id = old_id::integer
        LIMIT 1;
      END IF;

      -- Prefer an existing central type by either globally unique code.
      -- This safely collapses duplicated legacy Cash/Credit definitions.
      IF code_en_value <> '' THEN
        SELECT id INTO voucher_type_id
        FROM document_voucher_types
        WHERE org_id = journal_row.org_id
          AND lower(btrim(code_en)) = lower(code_en_value)
        ORDER BY id
        LIMIT 1;
      END IF;

      IF voucher_type_id IS NULL AND code_ar_value <> '' THEN
        SELECT id INTO voucher_type_id
        FROM document_voucher_types
        WHERE org_id = journal_row.org_id
          AND btrim(code_ar) = code_ar_value
        ORDER BY id
        LIMIT 1;
      END IF;

      IF voucher_type_id IS NULL THEN
        INSERT INTO document_voucher_types (
          org_id, name_ar, name_en, code_ar, code_en
        )
        VALUES (
          journal_row.org_id, name_ar_value, name_en_value,
          code_ar_value, code_en_value
        )
        RETURNING id INTO voucher_type_id;
      END IF;

      SELECT name_ar, name_en, code_ar, code_en
      INTO name_ar_value, name_en_value, code_ar_value, code_en_value
      FROM document_voucher_types
      WHERE id = voucher_type_id;

      mapped_type := type_row;
      mapped_type := jsonb_set(mapped_type, '{id}', to_jsonb(voucher_type_id::TEXT), true);
      mapped_type := jsonb_set(mapped_type, '{nameAr}', to_jsonb(name_ar_value), true);
      mapped_type := jsonb_set(mapped_type, '{nameEn}', to_jsonb(name_en_value), true);
      mapped_type := jsonb_set(mapped_type, '{codeAr}', to_jsonb(code_ar_value), true);
      mapped_type := jsonb_set(mapped_type, '{codeEn}', to_jsonb(code_en_value), true);
      new_types := new_types || jsonb_build_array(mapped_type);

      IF jsonb_typeof(config->'accountLinksByType') = 'object' THEN
        old_links := config->'accountLinksByType'->old_id;
        IF old_links IS NULL THEN
          old_links := config->'accountLinksByType'->(voucher_type_id::TEXT);
        END IF;
        IF old_links IS NOT NULL AND NOT (new_links ? (voucher_type_id::TEXT)) THEN
          new_links := jsonb_set(
            new_links,
            ARRAY[voucher_type_id::TEXT],
            old_links,
            true
          );
        END IF;
      END IF;
    END LOOP;

    config := jsonb_set(config, '{types}', new_types, true);
    IF new_links <> '{}'::JSONB THEN
      config := jsonb_set(config, '{accountLinksByType}', new_links, true);
    END IF;

    UPDATE document_journals
    SET payment_types_config = config
    WHERE id = journal_row.id;
  END LOOP;
END $$;
