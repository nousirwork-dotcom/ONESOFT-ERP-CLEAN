DO $$ BEGIN
  CREATE TYPE pending_movement_status AS ENUM ('unposted', 'linked', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS pending_account_movements (
  id serial PRIMARY KEY,
  org_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_doc_type varchar(50) NOT NULL,
  source_doc_id integer NOT NULL,
  source_doc_number varchar(100) NOT NULL,
  movement_date timestamp NOT NULL,
  account_id integer REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
  debit numeric(18,4) NOT NULL DEFAULT 0,
  credit numeric(18,4) NOT NULL DEFAULT 0,
  description text,
  status pending_movement_status NOT NULL DEFAULT 'unposted',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS pending_account_movements_source_account_uidx
  ON pending_account_movements(org_id, source_doc_type, source_doc_id, account_id);

CREATE TABLE IF NOT EXISTS pending_stock_movements (
  id serial PRIMARY KEY,
  org_id integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  source_doc_type varchar(50) NOT NULL,
  source_doc_id integer NOT NULL,
  source_doc_number varchar(100) NOT NULL,
  movement_date timestamp NOT NULL,
  product_id integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id integer REFERENCES warehouses(id) ON DELETE SET NULL,
  quantity numeric(18,4) NOT NULL,
  unit_cost numeric(18,4) NOT NULL DEFAULT 0,
  status pending_movement_status NOT NULL DEFAULT 'unposted',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS pending_stock_movements_source_product_uidx
  ON pending_stock_movements(org_id, source_doc_type, source_doc_id, product_id, warehouse_id);