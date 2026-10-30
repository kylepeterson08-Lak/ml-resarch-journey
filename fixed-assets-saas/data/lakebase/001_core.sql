-- Lakebase (managed Postgres) — system of record for interactive edits.
-- Delta in Unity Catalog holds published calc runs, history and audit; changes flow there
-- through the outbox table below. See docs/architecture.md and research/08.
--
-- Isolation: every tenant table carries tenant_id and has row-level security keyed on
-- current_setting('app.tenant_id'). The application connects as fa_app (NOBYPASSRLS) and sets
-- app.tenant_id per transaction with set_config('app.tenant_id', $1, true).

create extension if not exists btree_gist;

create schema if not exists fa;
set search_path = fa, public;

-- ---------------------------------------------------------------- tenancy & entities

create table tenant (
    tenant_id   uuid primary key,
    name        text not null,
    tier        text not null default 'pooled' check (tier in ('pooled', 'silo')),
    region      text not null default 'us',
    created_at  timestamptz not null default now()
);

create table entity (
    tenant_id             uuid not null references tenant,
    entity_id             uuid not null,
    legal_name            text not null,
    ein_ciphertext        bytea,  -- encrypted client-side with the tenant's data key
    entity_type           text not null check (entity_type in
                            ('C_CORP', 'S_CORP', 'PARTNERSHIP', 'INDIVIDUAL', 'TRUST', 'NFP', 'GOVERNMENT')),
    fy_start_month        smallint not null default 1 check (fy_start_month between 1 and 12),
    consolidated_group_id uuid,
    functional_currency   char(3) not null default 'USD',
    primary key (tenant_id, entity_id)
);

-- One row per book an entity keeps: FED_TAX, AMT, ACE, EP, GAAP, IFRS, STATE (one per state),
-- LOCAL_PP (one per property-tax jurisdiction), MGMT, SCENARIO.
create table book_def (
    tenant_id          uuid not null,
    book_id            uuid not null,
    entity_id          uuid not null,
    book_type          text not null check (book_type in
                         ('FED_TAX', 'AMT', 'ACE', 'EP', 'GAAP', 'IFRS', 'STATE', 'LOCAL_PP', 'MGMT', 'SCENARIO')),
    framework          text not null check (framework in ('IRC', 'US_GAAP', 'IFRS', 'STATE', 'LOCAL', 'GASB', 'OTHER')),
    jurisdiction_id    text not null default 'US',  -- 'US', 'US-CA', 'US-TX-201' (state FIPS-based ids)
    posting_mode       text not null default 'MEMO' check (posting_mode in ('GL_PRIMARY', 'GL_SECONDARY', 'GL_DELTA', 'MEMO')),
    derive_from_book   uuid,       -- e.g. STATE book derived from FED_TAX plus conformity rules
    rules_release_pin  text,       -- release id of fa_rules content this book computes with
    rounding_policy    text not null default 'HALF_UP_CENTS',
    policy_elections   jsonb not null default '{}',  -- effective-dated adoption data (ASU 2025-06, IAS 16 model, ...)
    primary key (tenant_id, book_id),
    foreign key (tenant_id, entity_id) references entity,
    foreign key (tenant_id, derive_from_book) references book_def (tenant_id, book_id)
);

create table location (
    tenant_id    uuid not null,
    location_id  uuid not null,
    entity_id    uuid not null,
    name         text not null,
    street       text,
    city         text,
    state_code   char(2),
    postal_code  text,
    county_fips  char(5),
    primary key (tenant_id, location_id),
    foreign key (tenant_id, entity_id) references entity
);

-- Situs → taxing jurisdictions over time (county, city, school/special districts).
create table location_jurisdiction (
    tenant_id        uuid not null,
    location_id      uuid not null,
    jurisdiction_id  text not null,
    valid_period     daterange not null,
    primary key (tenant_id, location_id, jurisdiction_id, valid_period),
    foreign key (tenant_id, location_id) references location
);

-- ---------------------------------------------------------------- assets

-- Shared asset master: facts that are the same in every book.
create table asset (
    tenant_id              uuid not null,
    asset_id               uuid not null,
    entity_id              uuid not null,
    asset_number           text not null,
    description            text not null,
    asset_class            text,  -- Rev. Proc. 87-56 class or statutory code (QIP, RES_RENTAL, ...)
    property_type          text not null check (property_type in ('1245', '1250', 'LAND', 'INTANGIBLE')),
    parent_asset_id        uuid,  -- component-of
    location_id            uuid,
    quantity               numeric(18, 4) not null default 1,
    acquired_on            date,
    binding_contract_on    date,  -- drives P.L. 119-21 bonus eligibility
    construction_began_on  date,  -- self-constructed property; §168(n)
    placed_in_service_on   date,
    cost                   numeric(18, 2) not null check (cost >= 0),
    land_cost              numeric(18, 2) not null default 0,
    new_or_used            text check (new_or_used in ('NEW', 'USED')),
    listed_property        boolean not null default false,
    business_use_pct       numeric(7, 4) not null default 1 check (business_use_pct > 0 and business_use_pct <= 1),
    vendor                 text,
    invoice_ref            text,
    status                 text not null default 'CIP' check (status in ('CIP', 'IN_SERVICE', 'IDLE', 'HFS', 'DISPOSED')),
    row_version            integer not null default 1,
    updated_at             timestamptz not null default now(),
    updated_by             text not null,
    primary key (tenant_id, asset_id),
    unique (tenant_id, entity_id, asset_number),
    foreign key (tenant_id, entity_id) references entity,
    foreign key (tenant_id, parent_asset_id) references asset (tenant_id, asset_id),
    foreign key (tenant_id, location_id) references location
);

-- Per-book treatment, bitemporal: valid_period = when it applies; recorded_at/superseded_at = when
-- we knew it. Corrections insert a new row and stamp superseded_at on the old one; nothing is updated
-- in place, so any past calculation can be reproduced.
create table asset_book_version (
    tenant_id        uuid not null,
    version_id       bigint generated always as identity,
    asset_id         uuid not null,
    book_id          uuid not null,
    valid_period     daterange not null,
    recorded_at      timestamptz not null default now(),
    superseded_at    timestamptz,
    method           text not null check (method in ('200DB', '150DB', 'SL', 'DDB', 'SYD', 'UOP', 'AMORT', 'NONE')),
    recovery_months  integer check (recovery_months > 0),
    convention       text check (convention in ('HY', 'MQ', 'MM', 'FM', 'NONE')),  -- FM = full month (book)
    basis            numeric(18, 2) not null,
    salvage          numeric(18, 2) not null default 0,
    section_179      numeric(18, 2) not null default 0,
    bonus_rate       numeric(5, 4) not null default 0 check (bonus_rate between 0 and 1),
    election_flags   jsonb not null default '{}',  -- ADS elected, bonus elect-out, §168(k)(10) transition, ...
    recorded_by      text not null,
    reason           text,
    primary key (tenant_id, version_id),
    foreign key (tenant_id, asset_id) references asset,
    foreign key (tenant_id, book_id) references book_def,
    exclude using gist (
        tenant_id with =, asset_id with =, book_id with =, valid_period with &&
    ) where (superseded_at is null)
);

create table asset_txn (
    tenant_id         uuid not null,
    txn_id            uuid not null,
    asset_id          uuid not null,
    txn_type          text not null check (txn_type in (
                        'ADD', 'ADJUST_COST', 'CIP_COST', 'PLACE_IN_SERVICE', 'TRANSFER', 'RECLASS',
                        'PARTIAL_DISPOSE', 'DISPOSE', 'RETIRE', 'ABANDON', 'CASUALTY', 'EXCHANGE',
                        'IMPAIR', 'IMPAIR_REVERSE', 'REVALUE', 'CLASSIFY_HFS', 'RECLASSIFY_FROM_HFS',
                        'CHANGE_ESTIMATE', 'ERROR_CORRECTION')),
    book_id           uuid,  -- null = applies to all books
    effective_on      date not null,
    posting_period    text not null,  -- e.g. '2026-10'; back-dated events post catch-up here
    amount            numeric(18, 2),
    proceeds          numeric(18, 2),
    selling_expenses  numeric(18, 2),
    disposed_pct      numeric(7, 4),
    detail            jsonb not null default '{}',
    recorded_at       timestamptz not null default now(),
    recorded_by       text not null,
    primary key (tenant_id, txn_id),
    foreign key (tenant_id, asset_id) references asset,
    foreign key (tenant_id, book_id) references book_def
);

-- Taxpayer-level inputs that make calculations entity-wide (mid-quarter test, §179 limit, carryovers).
create table entity_year_aggregate (
    tenant_id                uuid not null,
    entity_id                uuid not null,
    book_id                  uuid not null,
    tax_year                 integer not null,
    personal_property_basis  numeric(18, 2) not null default 0,
    q4_basis                 numeric(18, 2) not null default 0,
    mid_quarter_applies      boolean generated always as (q4_basis > personal_property_basis * 0.40) stored,
    s179_property_cost       numeric(18, 2) not null default 0,
    s179_elected             numeric(18, 2) not null default 0,
    s179_carryover_in        numeric(18, 2) not null default 0,
    business_income_limit    numeric(18, 2),
    primary key (tenant_id, entity_id, book_id, tax_year),
    foreign key (tenant_id, entity_id) references entity,
    foreign key (tenant_id, book_id) references book_def
);

-- ---------------------------------------------------------------- periods, results, audit

create table period (
    tenant_id    uuid not null,
    entity_id    uuid not null,
    book_id      uuid not null,
    period       text not null,
    status       text not null default 'OPEN' check (status in ('OPEN', 'PRE_CLOSE', 'CLOSED', 'REOPENED')),
    snapshot_id  text,  -- immutable Delta snapshot written at close
    closed_at    timestamptz,
    closed_by    text,
    primary key (tenant_id, entity_id, book_id, period),
    foreign key (tenant_id, book_id) references book_def
);

-- Serving cache for the current open period; the record of truth for runs is gold.calc_run in Delta.
create table calc_result_current (
    tenant_id         uuid not null,
    asset_id          uuid not null,
    book_id           uuid not null,
    tax_year          integer not null,
    depreciation      numeric(18, 2) not null,
    accumulated       numeric(18, 2) not null,
    net_book_value    numeric(18, 2) not null,
    run_id            text not null,
    rules_release_id  text not null,
    engine_version    text not null,
    primary key (tenant_id, asset_id, book_id, tax_year)
);

create table audit_event (
    tenant_id    uuid not null,
    seq          bigint generated always as identity,
    occurred_at  timestamptz not null default now(),
    actor        text not null,
    object_type  text not null,
    object_id    text not null,
    action       text not null,
    before       jsonb,
    after        jsonb,
    reason       text,
    prev_hash    bytea,
    row_hash     bytea,  -- hash chain; daily digests anchored to S3 Object Lock
    primary key (tenant_id, seq)
);

create table outbox (
    seq           bigint generated always as identity primary key,
    tenant_id     uuid not null,
    aggregate     text not null,
    aggregate_id  text not null,
    event_type    text not null,
    payload       jsonb not null,
    created_at    timestamptz not null default now(),
    drained_at    timestamptz
);

-- ---------------------------------------------------------------- row-level security

do $$
declare t text;
begin
    foreach t in array array[
        'entity', 'book_def', 'location', 'location_jurisdiction', 'asset', 'asset_book_version',
        'asset_txn', 'entity_year_aggregate', 'period', 'calc_result_current', 'audit_event', 'outbox'
    ] loop
        execute format('alter table %I enable row level security', t);
        execute format('alter table %I force row level security', t);
        -- After a transaction-local set_config ends, the setting reads as '' rather than NULL;
        -- nullif makes "no tenant context" match no rows instead of failing the uuid cast.
        execute format(
            'create policy tenant_isolation on %I '
            'using (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid) '
            'with check (tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid)', t);
    end loop;
end $$;

-- Application role: no RLS bypass; audit_event is insert-only.
do $$
begin
    if not exists (select 1 from pg_roles where rolname = 'fa_app') then
        create role fa_app nologin nobypassrls;
    end if;
end $$;

grant usage on schema fa to fa_app;
grant select on tenant to fa_app;
grant select, insert, update, delete on
    entity, book_def, location, location_jurisdiction, asset, asset_txn, entity_year_aggregate,
    period, calc_result_current
    to fa_app;
grant select, insert, update on asset_book_version to fa_app;  -- update only to stamp superseded_at
grant select, insert on audit_event, outbox to fa_app;
