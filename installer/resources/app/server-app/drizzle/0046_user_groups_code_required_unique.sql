-- 0046: user_groups code required + unique per org (active only)
-- Makes code NOT NULL on user_groups and enforces uniqueness within each org
-- among active groups (is_active = true). Inactive/deleted groups keep their
-- code so the historical record is intact, and the same code can be reused
-- if the group is recreated.

-- 1. Fill any existing NULL codes with a generated placeholder so NOT NULL
--    constraint can be applied without losing existing rows.
UPDATE user_groups
SET code = 'GRP-' || id::text
WHERE code IS NULL OR trim(code) = '';

-- 2. Make code NOT NULL
ALTER TABLE user_groups
  ALTER COLUMN code SET NOT NULL;

-- 3. Partial unique index: unique (org_id, code) only for active groups
CREATE UNIQUE INDEX IF NOT EXISTS ug_org_code_active_uidx
  ON user_groups (org_id, code)
  WHERE is_active = true;
