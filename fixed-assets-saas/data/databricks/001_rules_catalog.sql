-- Unity Catalog: rules & reference content (shared across tenants, no tenant data).
-- One catalog per environment: dev_rules / stg_rules / prod_rules. Change the USE line per env
-- (bundles/Terraform template it).
--
-- Schemas
--   staging    drafts written by research agents and SMEs (status draft | sme_reviewed)
--   releases   release manifests (four-eyes approval, content hash, git commit)
--   reference  published content; every row is stamped with the release that published it
--   tests      golden cases for regression packs
--
-- Time axes on every rule row (see research/08 §5, research/06 §8):
--   valid time      valid_from / valid_to — keyed to the date the law uses (tax year beginning,
--                   acquisition, placed in service, lien date)
--   knowledge time  recorded_at / superseded_at — when we knew it; retroactive enactments add rows,
--                   never rewrite them, so as-filed runs stay reproducible.

CREATE CATALOG IF NOT EXISTS dev_rules;
USE CATALOG dev_rules;

CREATE SCHEMA IF NOT EXISTS staging;
CREATE SCHEMA IF NOT EXISTS releases;
CREATE SCHEMA IF NOT EXISTS reference;
CREATE SCHEMA IF NOT EXISTS tests;

-- ------------------------------------------------------------------ releases & citations

CREATE TABLE IF NOT EXISTS releases.rule_release (
  release_id     STRING NOT NULL,
  scope          STRING NOT NULL COMMENT 'e.g. federal, state:CA, local:TX, forms:4562',
  status         STRING NOT NULL COMMENT 'testing | published | superseded | withdrawn',
  content_hash   STRING NOT NULL,
  git_commit     STRING,
  authored_by    STRING NOT NULL,
  approved_by    ARRAY<STRING> NOT NULL COMMENT 'reviewer(s) of record; must not include author',
  impact_report  STRING COMMENT 'path to the per-tenant impact diff in a UC volume',
  published_at   TIMESTAMP,
  notes          STRING,
  CONSTRAINT rule_release_pk PRIMARY KEY (release_id)
);

CREATE TABLE IF NOT EXISTS reference.source_citation (
  source_id     STRING NOT NULL,
  url           STRING NOT NULL,
  publisher     STRING NOT NULL,
  doc_type      STRING NOT NULL COMMENT 'STATUTE | REGULATION | REV_PROC | NOTICE | FORM_INSTR | DOR_GUIDANCE | ASSESSOR_TABLE | STANDARD | FIRM_ALERT',
  pin_cite      STRING COMMENT 'e.g. IRC 168(k)(6)(A); Rev. Proc. 2025-32 sec. 3.27',
  retrieved_at  TIMESTAMP NOT NULL,
  doc_sha256    STRING COMMENT 'hash of the retrieved document',
  CONSTRAINT source_citation_pk PRIMARY KEY (source_id)
);

-- ------------------------------------------------------------------ jurisdictions

CREATE TABLE IF NOT EXISTS reference.jurisdiction (
  jurisdiction_id  STRING NOT NULL COMMENT 'US | US-CA | US-CA-037 (county FIPS) | US-TX-CAD-101 | ...',
  level            STRING NOT NULL COMMENT 'FEDERAL | STATE | ASSESSING | TAXING_UNIT | TAX_RATE_AREA | CITY',
  code             STRING NOT NULL,
  name             STRING NOT NULL,
  parent_id        STRING,
  fips             STRING,
  has_cit          BOOLEAN,
  has_pit          BOOLEAN,
  has_bpp          BOOLEAN,
  valid_from       DATE NOT NULL,
  valid_to         DATE,
  release_id       STRING NOT NULL,
  CONSTRAINT jurisdiction_pk PRIMARY KEY (jurisdiction_id, valid_from)
);

-- ------------------------------------------------------------------ federal cost recovery

CREATE TABLE IF NOT EXISTS reference.asset_class (
  asset_class         STRING NOT NULL COMMENT 'Rev. Proc. 87-56 class or statutory code (QIP, RES_RENTAL, NONRES_REAL)',
  description         STRING NOT NULL,
  class_life          DECIMAL(5,1),
  gds_years           DECIMAL(5,1) NOT NULL,
  ads_years           DECIMAL(5,1) NOT NULL,
  property_type       STRING NOT NULL COMMENT '1245 | 1250',
  default_method      STRING NOT NULL,
  default_convention  STRING NOT NULL,
  valid_from          DATE NOT NULL,
  valid_to            DATE,
  recorded_at         TIMESTAMP NOT NULL,
  superseded_at       TIMESTAMP,
  source_ids          ARRAY<STRING> NOT NULL,
  status              STRING NOT NULL,
  release_id          STRING NOT NULL
);

-- Published IRS percentage tables (Pub 946 App. A). Loaded, not generated: the engine's
-- generator is tested against these rows.
CREATE TABLE IF NOT EXISTS reference.macrs_table (
  table_code        STRING NOT NULL COMMENT 'e.g. A-1, A-5, A-7a',
  method            STRING NOT NULL,
  convention        STRING NOT NULL,
  recovery_years    DECIMAL(5,1) NOT NULL,
  placed_period     INT NOT NULL COMMENT 'quarter 1-4 (MQ), month 1-12 (MM), 0 (HY)',
  recovery_year     INT NOT NULL,
  rate_pct          DECIMAL(8,3) NOT NULL,
  source_ids        ARRAY<STRING> NOT NULL,
  release_id        STRING NOT NULL
);

-- Scalar parameters by effective window: §179 limit/phase-out/SUV cap, §280F caps, etc.
CREATE TABLE IF NOT EXISTS reference.federal_parameter (
  param_key       STRING NOT NULL COMMENT 'S179_LIMIT | S179_PHASEOUT | S179_SUV | S280F_Y1 | S280F_Y1_BONUS | ...',
  keyed_on        STRING NOT NULL COMMENT 'TAX_YEAR_BEGIN | PLACED_IN_SERVICE | ACQUIRED',
  valid_from      DATE NOT NULL,
  valid_to        DATE,
  value           DECIMAL(18,4) NOT NULL,
  entity_types    ARRAY<STRING>,
  recorded_at     TIMESTAMP NOT NULL,
  superseded_at   TIMESTAMP,
  source_ids      ARRAY<STRING> NOT NULL,
  status          STRING NOT NULL,
  release_id      STRING NOT NULL
);

CREATE TABLE IF NOT EXISTS reference.bonus_rule (
  rule_id                STRING NOT NULL,
  property_scope         STRING NOT NULL COMMENT 'GENERAL | LONG_PRODUCTION | AIRCRAFT | SPECIFIED_PLANT | QPP_168N',
  acquired_on_or_after   DATE,
  acquired_on_or_before  DATE,
  pis_on_or_after        DATE,
  pis_on_or_before       DATE,
  rate                   DECIMAL(5,4) NOT NULL,
  elective_rates         ARRAY<DECIMAL(5,4)> COMMENT 'e.g. P.L. 119-21 transition election 0.40/0.60',
  recorded_at            TIMESTAMP NOT NULL,
  superseded_at          TIMESTAMP,
  source_ids             ARRAY<STRING> NOT NULL,
  status                 STRING NOT NULL,
  release_id             STRING NOT NULL
);

-- ------------------------------------------------------------------ state conformity (research/06 §8.2)

CREATE TABLE IF NOT EXISTS reference.conformity_regime (
  regime_id            STRING NOT NULL,
  jurisdiction_id      STRING NOT NULL,
  tax_type             STRING NOT NULL COMMENT 'CIT | PIT | PTET | FRANCHISE_MARGIN | UBT | ...',
  regime_type          STRING NOT NULL COMMENT 'ROLLING | STATIC | SELECTIVE',
  irc_as_of_date       DATE COMMENT 'null for rolling conformity',
  valid_from           DATE NOT NULL COMMENT 'tax years beginning on/after',
  valid_to             DATE,
  enacted_by           STRING,
  enacted_on           DATE,
  retroactive          BOOLEAN NOT NULL,
  recorded_at          TIMESTAMP NOT NULL,
  superseded_at        TIMESTAMP,
  confidence           STRING,
  source_ids           ARRAY<STRING> NOT NULL,
  status               STRING NOT NULL,
  release_id           STRING NOT NULL
);

CREATE TABLE IF NOT EXISTS reference.provision_rule (
  rule_id           STRING NOT NULL,
  regime_id         STRING NOT NULL,
  irc_section       STRING NOT NULL COMMENT '168(k) | 168(n) | 179 | 174A | 163(j) | ...',
  treatment         STRING NOT NULL COMMENT 'CONFORM | DECOUPLE_RECOMPUTE | PINNED_CODE | ADDBACK_SPREAD | LIMIT_OVERRIDE | FACTOR_SUBTRACTION | CREDIT_IN_LIEU | ELECTIVE',
  pinned_code_date  DATE,
  applicability     STRING COMMENT 'JSON: pis/acquired windows, property classes, entity types, zones',
  method_profile_id STRING,
  priority          INT NOT NULL,
  valid_from        DATE NOT NULL,
  valid_to          DATE,
  recorded_at       TIMESTAMP NOT NULL,
  superseded_at     TIMESTAMP,
  confidence        STRING,
  source_ids        ARRAY<STRING> NOT NULL,
  status            STRING NOT NULL,
  release_id        STRING NOT NULL
);

CREATE TABLE IF NOT EXISTS reference.addback_rule (
  rule_id                STRING NOT NULL COMMENT 'FK provision_rule',
  addback_pct            DECIMAL(5,4) NOT NULL,
  recovery_years         INT,
  recovery_start_offset  INT NOT NULL COMMENT 'years after the addback year that recovery begins',
  recovery_pattern       STRING NOT NULL COMMENT 'EQUAL | FACTOR | REMAINING_LIFE | FINAL_YEAR_CATCHUP',
  factor_formula         STRING COMMENT 'e.g. IL: bonus_pct / (1 - bonus_pct)',
  on_disposition         STRING NOT NULL COMMENT 'CONTINUE | ACCELERATE | NONE',
  release_id             STRING NOT NULL
);

CREATE TABLE IF NOT EXISTS reference.limit_rule (
  rule_id                 STRING NOT NULL COMMENT 'FK provision_rule',
  s179_limit              DECIMAL(18,2),
  phaseout_threshold      DECIMAL(18,2),
  apply_at                STRING NOT NULL COMMENT 'ENTITY | OWNER | BOTH',
  income_limit_basis      STRING COMMENT 'STATE | FEDERAL',
  release_id              STRING NOT NULL
);

CREATE TABLE IF NOT EXISTS reference.method_profile (
  method_profile_id  STRING NOT NULL COMMENT 'e.g. CA_CORP_ADR, NY_IRC_20010910, TX_IRC_20070101',
  name               STRING NOT NULL,
  method_map         STRING NOT NULL COMMENT 'JSON: property class -> method, convention, life',
  bonus_pct_override DECIMAL(5,4),
  allow_179          BOOLEAN NOT NULL,
  allow_168n         BOOLEAN NOT NULL,
  release_id         STRING NOT NULL
);

-- ------------------------------------------------------------------ local / business personal property (research/07)

CREATE TABLE IF NOT EXISTS reference.bpp_exemption_rule (
  rule_id            STRING NOT NULL,
  jurisdiction_id    STRING NOT NULL,
  exemption_type     STRING NOT NULL COMMENT 'FILING_THRESHOLD | CLIFF_DE_MINIMIS | DEDUCTION | PERCENTAGE | ASSET_CLASS',
  aggregation_scope  STRING NOT NULL COMMENT 'ASSET | LOCATION | ACCOUNT | TAXING_UNIT | COUNTY | LOCAL_UNIT | STATE | RELATED_PARTY_GROUP',
  value_basis        STRING NOT NULL COMMENT 'ACQUISITION_COST | MARKET_VALUE | TRUE_CASH_VALUE | ASSESSED_VALUE',
  amount             DECIMAL(18,2),
  pct                DECIMAL(7,4),
  asset_categories   ARRAY<STRING>,
  valid_from         DATE NOT NULL COMMENT 'assessment years from',
  valid_to           DATE,
  recorded_at        TIMESTAMP NOT NULL,
  superseded_at      TIMESTAMP,
  source_ids         ARRAY<STRING> NOT NULL,
  status             STRING NOT NULL,
  release_id         STRING NOT NULL
);

CREATE TABLE IF NOT EXISTS reference.assessor_factor (
  jurisdiction_id  STRING NOT NULL,
  assessment_year  INT NOT NULL,
  table_kind       STRING NOT NULL COMMENT 'INDEX | PERCENT_GOOD | COMPOSITE | STATUTORY',
  category_code    STRING NOT NULL,
  life_or_group    STRING,
  acquisition_year INT NOT NULL,
  factor           DECIMAL(9,4) NOT NULL,
  floor_factor     DECIMAL(9,4),
  source_ids       ARRAY<STRING> NOT NULL,
  status           STRING NOT NULL,
  release_id       STRING NOT NULL
);

-- Company asset class / GL account / MACRS class -> the jurisdiction's reporting category.
CREATE TABLE IF NOT EXISTS reference.category_map (
  jurisdiction_id    STRING NOT NULL,
  source_kind        STRING NOT NULL COMMENT 'ASSET_CLASS | MACRS_CLASS | GL_ACCOUNT',
  source_value       STRING NOT NULL,
  category_code      STRING NOT NULL,
  valid_from         DATE NOT NULL,
  valid_to           DATE,
  release_id         STRING NOT NULL
);

CREATE TABLE IF NOT EXISTS reference.filing_calendar (
  jurisdiction_id    STRING NOT NULL,
  filing_code        STRING NOT NULL COMMENT 'e.g. BOE-571-L, TX-50-144, FED-1120',
  tax_year           INT NOT NULL,
  lien_date          DATE,
  due_date           DATE NOT NULL,
  extension_rule     STRING COMMENT 'JSON: auto/on-request, request deadline, extended due',
  penalty_rule       STRING,
  roll_rule          STRING COMMENT 'weekend/holiday roll',
  release_id         STRING NOT NULL
);

-- ------------------------------------------------------------------ forms (research/04 §1)

CREATE TABLE IF NOT EXISTS reference.form (
  form_id          STRING NOT NULL COMMENT 'US-IRS-4562 | US-CA-FTB-3885A | US-CA-BOE-571L | US-TX-50-144',
  jurisdiction_id  STRING NOT NULL,
  number           STRING NOT NULL,
  title            STRING NOT NULL,
  filing_mode      STRING NOT NULL COMMENT 'ATTACHMENT | STANDALONE',
  parent_returns   ARRAY<STRING>,
  entity_types     ARRAY<STRING>,
  release_id       STRING NOT NULL
);

CREATE TABLE IF NOT EXISTS reference.form_revision (
  revision_id      STRING NOT NULL,
  form_id          STRING NOT NULL,
  revision_label   STRING NOT NULL COMMENT '2025 | Rev. December 2022',
  tax_year_from    INT NOT NULL,
  tax_year_to      INT,
  status           STRING NOT NULL COMMENT 'DRAFT | FINAL | CORRECTED | SUPERSEDED (draft revisions never render filing output)',
  pdf_url          STRING,
  pdf_sha256       STRING,
  instructions_url STRING,
  released_on      DATE,
  substitute_policy STRING COMMENT 'OFFICIAL_FILL | PUB1167_SUBSTITUTE | STATE_APPROVAL_REQUIRED | SUBSTANTIAL_COMPLIANCE',
  release_id       STRING NOT NULL
);

-- semantic_key decouples engine facts from line numbers, so a renumbered line is a mapping
-- change, not an engine change.
CREATE TABLE IF NOT EXISTS reference.form_line (
  revision_id      STRING NOT NULL,
  line_no          STRING NOT NULL COMMENT 'e.g. 12, 19h, 26(g)',
  part             STRING,
  caption          STRING NOT NULL,
  semantic_key     STRING NOT NULL COMMENT 'e.g. s179.deduction, macrs.gds.7yr.deduction',
  data_type        STRING NOT NULL COMMENT 'AMOUNT | INT | PCT | DATE | TEXT | BOOL',
  rounding         STRING NOT NULL COMMENT 'WHOLE_DOLLAR | CENTS',
  calc_expr        STRING COMMENT 'expression over other lines/facts, or null for a direct fact',
  repeating        STRING NOT NULL COMMENT 'NONE | ROWS | COLUMNS',
  pdf_field        STRING COMMENT 'AcroForm field name for this revision',
  efile_xpath      STRING COMMENT 'MeF / state schema path, or CA SDR element',
  source_ids       ARRAY<STRING> NOT NULL,
  status           STRING NOT NULL,
  release_id       STRING NOT NULL
);

-- ------------------------------------------------------------------ staging & tests

CREATE TABLE IF NOT EXISTS staging.rule_row (
  draft_id        STRING NOT NULL,
  target_table    STRING NOT NULL COMMENT 'reference table this row is proposed for',
  row_json        STRING NOT NULL,
  proposed_by     STRING NOT NULL COMMENT 'agent run id or SME',
  verified_by     STRING COMMENT 'independent verifier run id',
  verdict         STRING COMMENT 'CONFIRMED | WRONG | UNVERIFIABLE',
  status          STRING NOT NULL COMMENT 'draft | sme_reviewed | rejected | promoted',
  github_pr       STRING,
  created_at      TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS tests.golden_case (
  case_id       STRING NOT NULL,
  scope         STRING NOT NULL COMMENT 'federal | state:CA | local:TX | gaap | forms:4562',
  description   STRING NOT NULL,
  input_json    STRING NOT NULL,
  expected_json STRING NOT NULL,
  source_ids    ARRAY<STRING> NOT NULL
);
