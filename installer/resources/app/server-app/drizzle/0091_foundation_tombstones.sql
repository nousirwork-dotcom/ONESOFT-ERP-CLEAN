-- Foundation tombstones preserve an explicit customer deletion of a
-- foundation-managed flexible record. Reconciliation must not recreate it.
CREATE TABLE IF NOT EXISTS foundation_tombstones (
  id serial PRIMARY KEY,
  org_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  table_name varchar(100) NOT NULL,
  foundation_key varchar(255) NOT NULL,
  deleted_by integer REFERENCES users(id) ON DELETE SET NULL,
  deleted_at timestamp NOT NULL DEFAULT now(),
  reason text
);

CREATE UNIQUE INDEX IF NOT EXISTS tombstone_org_table_key
  ON foundation_tombstones(org_id, table_name, foundation_key);