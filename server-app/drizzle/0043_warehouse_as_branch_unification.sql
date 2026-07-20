-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0043: توحيد المخزن/الفرع — warehouseId هو مصدر الحقيقة الوحيد
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. إزالة branch_id من sales_invoices (0 بيانات — آمن) ──────────────────
DO $$BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='sales_invoices' AND column_name='branch_id'
  ) THEN
    -- تحقق أن العمود فارغ تماماً قبل الحذف
    IF (SELECT COUNT(*) FROM sales_invoices WHERE branch_id IS NOT NULL) > 0 THEN
      RAISE EXCEPTION 'sales_invoices.branch_id يحتوي بيانات — يجب مراجعة يدوية';
    END IF;
    ALTER TABLE sales_invoices DROP COLUMN branch_id;
  END IF;
END$$;

-- ── 2. إزالة branch_id و is_shared_journal من document_journals (0 بيانات) ──
DO $$BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='document_journals' AND column_name='branch_id'
  ) THEN
    IF (SELECT COUNT(*) FROM document_journals WHERE branch_id IS NOT NULL) > 0 THEN
      RAISE EXCEPTION 'document_journals.branch_id يحتوي بيانات — يجب مراجعة يدوية';
    END IF;
    ALTER TABLE document_journals DROP COLUMN branch_id;
  END IF;
END$$;

DO $$BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='document_journals' AND column_name='is_shared_journal'
  ) THEN
    ALTER TABLE document_journals DROP COLUMN is_shared_journal;
  END IF;
END$$;

-- ── 3. إزالة user_branch_assignments (0 بيانات) وإنشاء user_warehouse_assignments ──
DROP TABLE IF EXISTS user_branch_assignments;

CREATE TABLE IF NOT EXISTS user_warehouse_assignments (
  id           serial PRIMARY KEY,
  org_id       integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id      integer NOT NULL REFERENCES users(id)         ON DELETE CASCADE,
  warehouse_id integer NOT NULL REFERENCES warehouses(id)    ON DELETE CASCADE,
  created_at   timestamp NOT NULL DEFAULT now(),
  CONSTRAINT uwa_org_user_warehouse_unique UNIQUE (org_id, user_id, warehouse_id)
);

CREATE INDEX IF NOT EXISTS idx_uwa_org       ON user_warehouse_assignments(org_id);
CREATE INDEX IF NOT EXISTS idx_uwa_user      ON user_warehouse_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_uwa_warehouse ON user_warehouse_assignments(warehouse_id);
