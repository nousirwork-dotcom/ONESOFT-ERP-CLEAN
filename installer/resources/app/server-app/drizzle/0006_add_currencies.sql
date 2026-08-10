-- جدول العملات
CREATE TABLE IF NOT EXISTS currencies (
  id             serial PRIMARY KEY,
  org_id         integer NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code           varchar(10)  NOT NULL,
  name_ar        varchar(100) NOT NULL,
  name_en        varchar(100) NOT NULL,
  symbol         varchar(10)  NOT NULL,
  symbol_intl    varchar(10),
  exchange_rate  numeric(18,6) NOT NULL DEFAULT 1,
  decimal_places integer NOT NULL DEFAULT 2,
  is_base        boolean NOT NULL DEFAULT false,
  main_unit_ar   varchar(50),
  sub_unit_ar    varchar(50),
  main_unit_en   varchar(50),
  sub_unit_en    varchar(50),
  is_active      boolean NOT NULL DEFAULT true,
  created_at     timestamp NOT NULL DEFAULT now(),
  updated_at     timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS currencies_org_code_uidx ON currencies(org_id, code);
