-- Unity Catalog: tenant data (pooled tier). dev_tenant / stg_tenant / prod_tenant.
-- Silo-tier tenants get their own catalog with the same layout on a dedicated storage location and key.
--
--   bronze  raw landings: outbox events drained from Lakebase, import files (Auto Loader)
--   silver  conformed, bitemporal copies of the Lakebase system of record
--   gold    calc runs and their outputs (immutable per run_id), form line values, BPP returns
--   audit   append-only, hash-chained event log
--
-- Isolation: every table carries tenant_id (first clustering key) and the row filter below.
-- Batch service principals in fa_platform_batch see all rows; their jobs are partitioned by tenant
-- and audited. Every other principal sees only tenants granted in ops.principal_tenant.

CREATE CATALOG IF NOT EXISTS dev_tenant;
USE CATALOG dev_tenant;

CREATE SCHEMA IF NOT EXISTS bronze;
CREATE SCHEMA IF NOT EXISTS silver;
CREATE SCHEMA IF NOT EXISTS gold;
CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS ops;
CREATE SCHEMA IF NOT EXISTS security;

CREATE TABLE IF NOT EXISTS ops.principal_tenant (
  principal   STRING NOT NULL COMMENT 'user or service principal',
  tenant_id   STRING NOT NULL,
  granted_by  STRING NOT NULL,
  granted_at  TIMESTAMP NOT NULL
);

CREATE OR REPLACE FUNCTION security.tenant_row_filter(tenant_id STRING)
RETURNS BOOLEAN
RETURN is_account_group_member('fa_platform_batch')
    OR EXISTS (
      SELECT 1 FROM ops.principal_tenant p
      WHERE p.principal = current_user() AND p.tenant_id = tenant_row_filter.tenant_id
    );

-- ------------------------------------------------------------------ bronze

CREATE TABLE IF NOT EXISTS bronze.outbox_event (
  tenant_id     STRING NOT NULL,
  seq           BIGINT NOT NULL,
  aggregate     STRING NOT NULL,
  aggregate_id  STRING NOT NULL,
  event_type    STRING NOT NULL,
  payload       STRING NOT NULL COMMENT 'JSON as written by Lakebase',
  created_at    TIMESTAMP NOT NULL,
  ingested_at   TIMESTAMP NOT NULL
)
CLUSTER BY (tenant_id, created_at);

-- ------------------------------------------------------------------ silver (bitemporal)

CREATE TABLE IF NOT EXISTS silver.asset_version (
  tenant_id             STRING NOT NULL,
  asset_id              STRING NOT NULL,
  entity_id             STRING NOT NULL,
  asset_number          STRING NOT NULL,
  description           STRING,
  asset_class           STRING,
  property_type         STRING NOT NULL,
  location_id           STRING,
  acquired_on           DATE,
  binding_contract_on   DATE,
  construction_began_on DATE,
  placed_in_service_on  DATE,
  cost                  DECIMAL(18,2) NOT NULL,
  business_use_pct      DECIMAL(7,4) NOT NULL,
  status                STRING NOT NULL,
  recorded_at           TIMESTAMP NOT NULL,
  superseded_at         TIMESTAMP
)
CLUSTER BY (tenant_id, asset_id)
TBLPROPERTIES ('delta.enableChangeDataFeed' = 'true');

CREATE TABLE IF NOT EXISTS silver.asset_book_version (
  tenant_id        STRING NOT NULL,
  version_id       BIGINT NOT NULL,
  asset_id         STRING NOT NULL,
  book_id          STRING NOT NULL,
  valid_from       DATE NOT NULL,
  valid_to         DATE,
  recorded_at      TIMESTAMP NOT NULL,
  superseded_at    TIMESTAMP,
  method           STRING NOT NULL,
  recovery_months  INT,
  convention       STRING,
  basis            DECIMAL(18,2) NOT NULL,
  salvage          DECIMAL(18,2) NOT NULL,
  section_179      DECIMAL(18,2) NOT NULL,
  bonus_rate       DECIMAL(5,4) NOT NULL,
  election_flags   STRING
)
CLUSTER BY (tenant_id, asset_id, book_id)
TBLPROPERTIES ('delta.enableChangeDataFeed' = 'true');

CREATE TABLE IF NOT EXISTS silver.asset_txn (
  tenant_id         STRING NOT NULL,
  txn_id            STRING NOT NULL,
  asset_id          STRING NOT NULL,
  txn_type          STRING NOT NULL,
  book_id           STRING,
  effective_on      DATE NOT NULL,
  posting_period    STRING NOT NULL,
  amount            DECIMAL(18,2),
  proceeds          DECIMAL(18,2),
  selling_expenses  DECIMAL(18,2),
  disposed_pct      DECIMAL(7,4),
  detail            STRING,
  recorded_at       TIMESTAMP NOT NULL
)
CLUSTER BY (tenant_id, asset_id);

-- ------------------------------------------------------------------ gold (immutable per run)

CREATE TABLE IF NOT EXISTS gold.calc_run (
  run_id             STRING NOT NULL,
  tenant_id          STRING NOT NULL,
  run_type           STRING NOT NULL COMMENT 'ON_SAVE | WHAT_IF | NIGHTLY | FLEET | PERIOD_CLOSE | AS_FILED_REPRO',
  rules_release_id   STRING NOT NULL,
  engine_version     STRING NOT NULL,
  input_snapshot     STRING NOT NULL COMMENT 'Delta versions of the silver tables read',
  inputs_hash        STRING NOT NULL,
  started_at         TIMESTAMP NOT NULL,
  finished_at        TIMESTAMP,
  status             STRING NOT NULL
)
CLUSTER BY (tenant_id, started_at);

CREATE TABLE IF NOT EXISTS gold.depr_schedule (
  run_id          STRING NOT NULL,
  tenant_id       STRING NOT NULL,
  entity_id       STRING NOT NULL,
  asset_id        STRING NOT NULL,
  book_id         STRING NOT NULL,
  tax_year        INT NOT NULL,
  months          DECIMAL(5,2) NOT NULL,
  rate_pct        DECIMAL(12,8) NOT NULL,
  section_179     DECIMAL(18,2) NOT NULL,
  bonus           DECIMAL(18,2) NOT NULL,
  depreciation    DECIMAL(18,2) NOT NULL,
  accumulated     DECIMAL(18,2) NOT NULL,
  net_book_value  DECIMAL(18,2) NOT NULL
)
CLUSTER BY (tenant_id, run_id, asset_id);

CREATE TABLE IF NOT EXISTS gold.form_line_value (
  run_id           STRING NOT NULL,
  tenant_id        STRING NOT NULL,
  entity_id        STRING NOT NULL,
  form_id          STRING NOT NULL,
  revision_id      STRING NOT NULL,
  tax_year         INT NOT NULL,
  semantic_key     STRING NOT NULL,
  line_no          STRING NOT NULL,
  row_index        INT,
  value            STRING NOT NULL,
  source           STRING NOT NULL COMMENT 'CALC | OVERRIDE',
  override_reason  STRING,
  lineage_assets   ARRAY<STRING>
)
CLUSTER BY (tenant_id, run_id, form_id);

CREATE TABLE IF NOT EXISTS gold.state_spread_ledger (
  tenant_id         STRING NOT NULL,
  entity_id         STRING NOT NULL,
  jurisdiction_id   STRING NOT NULL,
  origin_tax_year   INT NOT NULL,
  rule_id           STRING NOT NULL,
  addback_amount    DECIMAL(18,2) NOT NULL,
  tax_year          INT NOT NULL,
  subtraction       DECIMAL(18,2) NOT NULL,
  run_id            STRING NOT NULL
)
CLUSTER BY (tenant_id, entity_id);

CREATE TABLE IF NOT EXISTS gold.bpp_return_line (
  run_id            STRING NOT NULL,
  tenant_id         STRING NOT NULL,
  entity_id         STRING NOT NULL,
  jurisdiction_id   STRING NOT NULL,
  filing_account    STRING,
  assessment_year   INT NOT NULL,
  lien_date         DATE NOT NULL,
  category_code     STRING NOT NULL,
  acquisition_year  INT NOT NULL,
  original_cost     DECIMAL(18,2) NOT NULL,
  factor            DECIMAL(9,4),
  estimated_value   DECIMAL(18,2)
)
CLUSTER BY (tenant_id, run_id, jurisdiction_id);

-- ------------------------------------------------------------------ audit

CREATE TABLE IF NOT EXISTS audit.event (
  tenant_id    STRING NOT NULL,
  seq          BIGINT NOT NULL,
  occurred_at  TIMESTAMP NOT NULL,
  actor        STRING NOT NULL,
  object_type  STRING NOT NULL,
  object_id    STRING NOT NULL,
  action       STRING NOT NULL,
  before       STRING,
  after        STRING,
  reason       STRING,
  prev_hash    STRING,
  row_hash     STRING NOT NULL
)
CLUSTER BY (tenant_id, occurred_at)
TBLPROPERTIES ('delta.appendOnly' = 'true');

-- ------------------------------------------------------------------ row filters

ALTER TABLE bronze.outbox_event       SET ROW FILTER security.tenant_row_filter ON (tenant_id);
ALTER TABLE silver.asset_version      SET ROW FILTER security.tenant_row_filter ON (tenant_id);
ALTER TABLE silver.asset_book_version SET ROW FILTER security.tenant_row_filter ON (tenant_id);
ALTER TABLE silver.asset_txn          SET ROW FILTER security.tenant_row_filter ON (tenant_id);
ALTER TABLE gold.calc_run             SET ROW FILTER security.tenant_row_filter ON (tenant_id);
ALTER TABLE gold.depr_schedule        SET ROW FILTER security.tenant_row_filter ON (tenant_id);
ALTER TABLE gold.form_line_value      SET ROW FILTER security.tenant_row_filter ON (tenant_id);
ALTER TABLE gold.state_spread_ledger  SET ROW FILTER security.tenant_row_filter ON (tenant_id);
ALTER TABLE gold.bpp_return_line      SET ROW FILTER security.tenant_row_filter ON (tenant_id);
ALTER TABLE audit.event               SET ROW FILTER security.tenant_row_filter ON (tenant_id);
