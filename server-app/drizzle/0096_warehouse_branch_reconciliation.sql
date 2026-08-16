-- Warehouse-as-branch reconciliation.
--
-- OneSoft treats an active warehouse as a branch. Older Foundation snapshots
-- could leave a second code-001 row and/or WH-MAIN behind. Pick one canonical
-- row per organization, move every known warehouse reference to it, verify
-- there are no stale references, then soft-disable the redundant rows.
CREATE TEMP TABLE _warehouse_reconciliation_map (
  old_id integer PRIMARY KEY,
  org_id integer NOT NULL,
  canonical_id integer NOT NULL
) ON COMMIT DROP;

CREATE TEMP TABLE _warehouse_reconciliation_canonical (
  org_id integer PRIMARY KEY,
  canonical_id integer NOT NULL
) ON COMMIT DROP;

WITH candidates AS (
  SELECT
    w.id,
    w.org_id,
    row_number() OVER (
      PARTITION BY w.org_id
      ORDER BY
        CASE
          WHEN w.is_active = true AND w.foundation_key = 'wh.001' THEN 0
          WHEN w.is_active = true AND w.code = '001' THEN 1
          WHEN upper(coalesce(w.code, '')) = 'WH-MAIN' THEN 2
          WHEN w.foundation_key = 'wh.001' THEN 3
          WHEN w.code = '001' THEN 4
          ELSE 5
        END,
        w.id
    ) AS rn
  FROM warehouses w
  WHERE
    w.foundation_key = 'wh.001'
    OR w.code = '001'
    OR upper(coalesce(w.code, '')) = 'WH-MAIN'
)
INSERT INTO _warehouse_reconciliation_canonical (org_id, canonical_id)
SELECT org_id, id
FROM candidates
WHERE rn = 1;

INSERT INTO _warehouse_reconciliation_map (old_id, org_id, canonical_id)
SELECT w.id, w.org_id, c.canonical_id
FROM warehouses w
JOIN _warehouse_reconciliation_canonical c
  ON c.org_id = w.org_id
 AND c.canonical_id <> w.id
WHERE
  w.code = '001'
  OR upper(coalesce(w.code, '')) = 'WH-MAIN'
  OR w.foundation_key IN ('wh.001', 'wh.المخزن_الرئيسي');

/*
 * The canonical table is session-local and intentionally kept separate from
 * the source map: an organization with only one legacy warehouse has no
 * source row to map, but still needs its selected row normalized below.
 */
UPDATE warehouses w
SET code = '001',
    foundation_key = 'wh.001',
    include_in_foundation = true
WHERE w.id IN (
  SELECT canonical_id
  FROM _warehouse_reconciliation_canonical
);

-- Direct warehouse references.
UPDATE users u
SET default_warehouse_id = m.canonical_id
FROM _warehouse_reconciliation_map m
WHERE u.org_id = m.org_id
  AND u.default_warehouse_id = m.old_id;

UPDATE user_warehouse_assignments t
SET warehouse_id = m.canonical_id
FROM _warehouse_reconciliation_map m
WHERE t.org_id = m.org_id
  AND t.warehouse_id = m.old_id;

UPDATE warehouses t
SET copy_from_warehouse_id = m.canonical_id
FROM _warehouse_reconciliation_map m
WHERE t.copy_from_warehouse_id = m.old_id;

UPDATE warehouse_account_links t
SET warehouse_id = m.canonical_id
FROM _warehouse_reconciliation_map m
WHERE t.warehouse_id = m.old_id;

UPDATE document_journals t
SET warehouse_id = m.canonical_id
FROM _warehouse_reconciliation_map m
WHERE t.org_id = m.org_id
  AND t.warehouse_id = m.old_id;

UPDATE inventory t
SET warehouse_id = m.canonical_id
FROM _warehouse_reconciliation_map m
WHERE t.org_id = m.org_id
  AND t.warehouse_id = m.old_id;

UPDATE inventory_counts t
SET warehouse_id = m.canonical_id
FROM _warehouse_reconciliation_map m
WHERE t.org_id = m.org_id
  AND t.warehouse_id = m.old_id;

UPDATE pending_stock_movements t
SET warehouse_id = m.canonical_id
FROM _warehouse_reconciliation_map m
WHERE t.org_id = m.org_id
  AND t.warehouse_id = m.old_id;

UPDATE purchase_invoices t
SET warehouse_id = m.canonical_id
FROM _warehouse_reconciliation_map m
WHERE t.org_id = m.org_id
  AND t.warehouse_id = m.old_id;

UPDATE sales_invoice_items t
SET warehouse_id = m.canonical_id
FROM _warehouse_reconciliation_map m
WHERE t.org_id = m.org_id
  AND t.warehouse_id = m.old_id;

UPDATE sales_invoices t
SET warehouse_id = m.canonical_id
FROM _warehouse_reconciliation_map m
WHERE t.org_id = m.org_id
  AND t.warehouse_id = m.old_id;

UPDATE stock_vouchers t
SET warehouse_id = m.canonical_id
FROM _warehouse_reconciliation_map m
WHERE t.org_id = m.org_id
  AND t.warehouse_id = m.old_id;

UPDATE zatca_pos_units t
SET warehouse_id = m.canonical_id
FROM _warehouse_reconciliation_map m
WHERE t.org_id = m.org_id
  AND t.warehouse_id = m.old_id;

UPDATE zatca_readiness_settings t
SET warehouse_id = m.canonical_id
FROM _warehouse_reconciliation_map m
WHERE t.org_id = m.org_id
  AND t.warehouse_id = m.old_id;

-- A reconciliation is only safe if every known reference moved.
DO $$
DECLARE
  remaining bigint;
BEGIN
  SELECT COALESCE(SUM(n), 0)
  INTO remaining
  FROM (
    SELECT count(*) AS n FROM users u
      JOIN _warehouse_reconciliation_map m
        ON m.org_id = u.org_id AND m.old_id = u.default_warehouse_id
    UNION ALL
    SELECT count(*) FROM user_warehouse_assignments t
      JOIN _warehouse_reconciliation_map m
        ON m.org_id = t.org_id AND m.old_id = t.warehouse_id
    UNION ALL
    SELECT count(*) FROM warehouses t
      JOIN _warehouse_reconciliation_map m ON m.old_id = t.copy_from_warehouse_id
    UNION ALL
    SELECT count(*) FROM warehouse_account_links t
      JOIN _warehouse_reconciliation_map m ON m.old_id = t.warehouse_id
    UNION ALL
    SELECT count(*) FROM document_journals t
      JOIN _warehouse_reconciliation_map m
        ON m.org_id = t.org_id AND m.old_id = t.warehouse_id
    UNION ALL
    SELECT count(*) FROM inventory t
      JOIN _warehouse_reconciliation_map m
        ON m.org_id = t.org_id AND m.old_id = t.warehouse_id
    UNION ALL
    SELECT count(*) FROM inventory_counts t
      JOIN _warehouse_reconciliation_map m
        ON m.org_id = t.org_id AND m.old_id = t.warehouse_id
    UNION ALL
    SELECT count(*) FROM pending_stock_movements t
      JOIN _warehouse_reconciliation_map m
        ON m.org_id = t.org_id AND m.old_id = t.warehouse_id
    UNION ALL
    SELECT count(*) FROM purchase_invoices t
      JOIN _warehouse_reconciliation_map m
        ON m.org_id = t.org_id AND m.old_id = t.warehouse_id
    UNION ALL
    SELECT count(*) FROM sales_invoice_items t
      JOIN _warehouse_reconciliation_map m
        ON m.org_id = t.org_id AND m.old_id = t.warehouse_id
    UNION ALL
    SELECT count(*) FROM sales_invoices t
      JOIN _warehouse_reconciliation_map m
        ON m.org_id = t.org_id AND m.old_id = t.warehouse_id
    UNION ALL
    SELECT count(*) FROM stock_vouchers t
      JOIN _warehouse_reconciliation_map m
        ON m.org_id = t.org_id AND m.old_id = t.warehouse_id
    UNION ALL
    SELECT count(*) FROM zatca_pos_units t
      JOIN _warehouse_reconciliation_map m
        ON m.org_id = t.org_id AND m.old_id = t.warehouse_id
    UNION ALL
    SELECT count(*) FROM zatca_readiness_settings t
      JOIN _warehouse_reconciliation_map m
        ON m.org_id = t.org_id AND m.old_id = t.warehouse_id
  ) stale;

  IF remaining <> 0 THEN
    RAISE EXCEPTION
      'warehouse reconciliation left % stale references', remaining;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM warehouses w
    WHERE w.is_active = true
      AND (
        upper(coalesce(w.code, '')) = 'WH-MAIN'
        OR w.foundation_key IN ('wh.001', 'wh.المخزن_الرئيسي')
      )
      AND NOT EXISTS (
        SELECT 1
        FROM _warehouse_reconciliation_map m
        WHERE m.old_id = w.id
      )
      AND NOT (
        w.code = '001'
        AND w.foundation_key = 'wh.001'
        AND w.include_in_foundation = true
      )
  ) THEN
    RAISE EXCEPTION
      'warehouse reconciliation left an active non-canonical Foundation warehouse';
  END IF;
END $$;

-- Preserve history as an inactive row, but remove Foundation identity so the
-- retired duplicate/WH-MAIN cannot be recreated by a later snapshot update.
UPDATE warehouses old
SET is_active = false,
    foundation_key = NULL,
    include_in_foundation = false,
    record_origin = 'user',
    foundation_template_version = NULL
FROM _warehouse_reconciliation_map m
WHERE old.id = m.old_id;