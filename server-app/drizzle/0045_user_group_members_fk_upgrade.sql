-- 0045: user_group_members FK upgrade
-- Adds member_user_id / member_group_id FK columns, migrates legacy code-based data,
-- logs unmatched records, deduplicates before unique indexes, and creates partial unique indexes.

-- 1. Migration log table for unmatched legacy records
CREATE TABLE IF NOT EXISTS user_group_migration_log (
  id              SERIAL PRIMARY KEY,
  original_member_id INTEGER,
  group_id        INTEGER,
  member_type     VARCHAR(10),
  member_code     VARCHAR(50),
  member_name     VARCHAR(255),
  reason          TEXT,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2. Add FK columns (nullable — legacy rows may not resolve)
ALTER TABLE user_group_members
  ADD COLUMN IF NOT EXISTS member_user_id  INTEGER REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS member_group_id INTEGER REFERENCES user_groups(id) ON DELETE CASCADE;

-- 3. Backfill member_user_id from existing member_code
UPDATE user_group_members ugm
SET member_user_id = u.id
FROM users u
WHERE ugm.member_type = 'user'
  AND ugm.member_code IS NOT NULL
  AND u.code = ugm.member_code
  AND u.org_id = ugm.org_id
  AND ugm.member_user_id IS NULL;

-- 4. Backfill member_group_id from existing member_code
UPDATE user_group_members ugm
SET member_group_id = ug.id
FROM user_groups ug
WHERE ugm.member_type = 'group'
  AND ugm.member_code IS NOT NULL
  AND ug.code = ugm.member_code
  AND ug.org_id = ugm.org_id
  AND ugm.member_group_id IS NULL;

-- 5. Log unmatched user records
INSERT INTO user_group_migration_log
  (original_member_id, group_id, member_type, member_code, member_name, reason)
SELECT id, group_id, member_type, member_code, member_name, 'user_not_found_by_code'
FROM user_group_members
WHERE member_type = 'user' AND member_user_id IS NULL AND member_code IS NOT NULL;

-- 6. Log unmatched group records
INSERT INTO user_group_migration_log
  (original_member_id, group_id, member_type, member_code, member_name, reason)
SELECT id, group_id, member_type, member_code, member_name, 'group_not_found_by_code'
FROM user_group_members
WHERE member_type = 'group' AND member_group_id IS NULL AND member_code IS NOT NULL;

-- 7a. Deduplicate user members (keep oldest row per group + user pair)
DELETE FROM user_group_members a
USING user_group_members b
WHERE a.member_user_id IS NOT NULL
  AND a.group_id       = b.group_id
  AND a.member_user_id = b.member_user_id
  AND a.id             > b.id;

-- 7b. Deduplicate group members (keep oldest row per group + sub-group pair)
DELETE FROM user_group_members a
USING user_group_members b
WHERE a.member_group_id IS NOT NULL
  AND a.group_id        = b.group_id
  AND a.member_group_id = b.member_group_id
  AND a.id              > b.id;

-- 8. Partial unique indexes (nulls are naturally excluded)
CREATE UNIQUE INDEX IF NOT EXISTS ugm_user_unique_idx
  ON user_group_members (group_id, member_user_id)
  WHERE member_user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ugm_group_unique_idx
  ON user_group_members (group_id, member_group_id)
  WHERE member_group_id IS NOT NULL;
