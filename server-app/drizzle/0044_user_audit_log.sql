-- ── 0044: جدول سجل تدقيق عمليات الحذف والإيقاف ──────────────────────────────
-- لا يحتوي على FK بالـ CASCADE إلى users حتى يبقى السجل حتى بعد حذف المستخدم المستهدف

CREATE TABLE IF NOT EXISTS user_audit_logs (
  id               SERIAL PRIMARY KEY,
  org_id           INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_user_id    INTEGER NOT NULL,
  actor_username   VARCHAR(100) NOT NULL,
  target_user_id   INTEGER NOT NULL,
  target_code      VARCHAR(50),
  target_name      VARCHAR(255) NOT NULL,
  target_username  VARCHAR(100) NOT NULL,
  action           VARCHAR(30) NOT NULL,   -- DELETE_USER | DEACTIVATE_USER
  reason           TEXT,
  ip_address       VARCHAR(100),
  device_info      VARCHAR(255),
  result           VARCHAR(20) NOT NULL DEFAULT 'success',  -- success | rejected
  result_reason    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_audit_logs_org_idx    ON user_audit_logs(org_id);
CREATE INDEX IF NOT EXISTS user_audit_logs_actor_idx  ON user_audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS user_audit_logs_target_idx ON user_audit_logs(target_user_id);
