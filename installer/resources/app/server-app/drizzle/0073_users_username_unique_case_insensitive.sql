-- Prevent ambiguous login identities inside one organization.
CREATE UNIQUE INDEX IF NOT EXISTS users_org_username_unique_lower
  ON users (org_id, lower(trim(username)));