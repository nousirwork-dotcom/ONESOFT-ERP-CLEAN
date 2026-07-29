-- Migration 0041: جدول ربط المستخدمين بالفروع (user_branch_assignments)
CREATE TABLE IF NOT EXISTS user_branch_assignments (
  id         serial PRIMARY KEY,
  org_id     integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id    integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  branch_id  integer NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT user_branch_assignments_user_branch_unique UNIQUE (user_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_uba_org     ON user_branch_assignments(org_id);
CREATE INDEX IF NOT EXISTS idx_uba_user    ON user_branch_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_uba_branch  ON user_branch_assignments(branch_id);
