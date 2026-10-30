-- Isolation and integrity checks for 001_core.sql. Run against a scratch database:
--   psql -v ON_ERROR_STOP=1 -f 001_core.sql -f tests/001_isolation_test.sql
-- Any failed expectation raises and aborts.

set search_path = fa, public;

insert into tenant (tenant_id, name) values
    ('00000000-0000-0000-0000-00000000000a', 'Tenant A'),
    ('00000000-0000-0000-0000-00000000000b', 'Tenant B');

set role fa_app;

-- Tenant A writes an entity, a federal book, an asset and its first book version.
begin;
select set_config('app.tenant_id', '00000000-0000-0000-0000-00000000000a', true);
insert into entity (tenant_id, entity_id, legal_name, entity_type)
    values ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001', 'A Corp', 'C_CORP');
insert into book_def (tenant_id, book_id, entity_id, book_type, framework)
    values ('00000000-0000-0000-0000-00000000000a', '20000000-0000-0000-0000-000000000001',
            '10000000-0000-0000-0000-000000000001', 'FED_TAX', 'IRC');
insert into asset (tenant_id, asset_id, entity_id, asset_number, description, property_type,
                   acquired_on, placed_in_service_on, cost, status, updated_by)
    values ('00000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-000000000001',
            '10000000-0000-0000-0000-000000000001', 'EQ-1', 'CNC mill', '1245',
            '2025-03-01', '2025-03-01', 250000, 'IN_SERVICE', 'test');
insert into asset_book_version (tenant_id, asset_id, book_id, valid_period, method, recovery_months,
                                convention, basis, bonus_rate, recorded_by)
    values ('00000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-000000000001',
            '20000000-0000-0000-0000-000000000001', daterange('2025-03-01', null), '200DB', 84,
            'HY', 250000, 1.0, 'test');
commit;

-- Tenant B sees none of it and cannot write into tenant A.
begin;
select set_config('app.tenant_id', '00000000-0000-0000-0000-00000000000b', true);
do $$
begin
    if (select count(*) from fa.asset) <> 0 or (select count(*) from fa.asset_book_version) <> 0 then
        raise exception 'FAIL: tenant B can read tenant A rows';
    end if;
    begin
        insert into fa.entity (tenant_id, entity_id, legal_name, entity_type)
            values ('00000000-0000-0000-0000-00000000000a', gen_random_uuid(), 'Smuggled', 'C_CORP');
        raise exception 'FAIL: tenant B inserted a row for tenant A';
    exception when insufficient_privilege then
        null;  -- expected: RLS WITH CHECK violation
    end;
    update fa.asset set description = 'tampered';
    if found then
        raise exception 'FAIL: tenant B updated tenant A rows';
    end if;
end $$;
commit;

-- No tenant context at all: nothing visible.
begin;
do $$
begin
    if (select count(*) from fa.asset) <> 0 then
        raise exception 'FAIL: rows visible without app.tenant_id';
    end if;
end $$;
commit;

-- Bitemporal rules inside tenant A.
begin;
select set_config('app.tenant_id', '00000000-0000-0000-0000-00000000000a', true);
do $$
begin
    -- A second *current* version overlapping the first must be rejected.
    begin
        insert into fa.asset_book_version (tenant_id, asset_id, book_id, valid_period, method, recovery_months,
                                           convention, basis, recorded_by)
            values ('00000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-000000000001',
                    '20000000-0000-0000-0000-000000000001', daterange('2025-06-01', null), 'SL', 84, 'HY',
                    250000, 'test');
        raise exception 'FAIL: overlapping current versions accepted';
    exception when exclusion_violation then
        null;
    end;

    -- Correct the record: supersede the old version, then insert the correction (ADS elected).
    update fa.asset_book_version set superseded_at = now()
        where asset_id = '30000000-0000-0000-0000-000000000001' and superseded_at is null;
    insert into fa.asset_book_version (tenant_id, asset_id, book_id, valid_period, method, recovery_months,
                                       convention, basis, election_flags, recorded_by, reason)
        values ('00000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-000000000001',
                '20000000-0000-0000-0000-000000000001', daterange('2025-03-01', null), 'SL', 120, 'HY',
                250000, '{"ads_elected": true}', 'test', 'ADS election for electing real property trade');
    if (select count(*) from fa.asset_book_version) <> 2 then
        raise exception 'FAIL: history row lost on correction';
    end if;

    -- The audit log is insert-only for the application role.
    insert into fa.audit_event (tenant_id, actor, object_type, object_id, action)
        values ('00000000-0000-0000-0000-00000000000a', 'test', 'asset', 'EQ-1', 'UPDATE');
    begin
        update fa.audit_event set actor = 'someone else';
        raise exception 'FAIL: audit_event is updatable';
    exception when insufficient_privilege then
        null;
    end;

    -- Mid-quarter flag derives from the aggregates (Q4 basis > 40%).
    insert into fa.entity_year_aggregate (tenant_id, entity_id, book_id, tax_year, personal_property_basis, q4_basis)
        values ('00000000-0000-0000-0000-00000000000a', '10000000-0000-0000-0000-000000000001',
                '20000000-0000-0000-0000-000000000001', 2025, 1000000, 410000);
    if not (select mid_quarter_applies from fa.entity_year_aggregate) then
        raise exception 'FAIL: mid-quarter flag not set at 41%%';
    end if;
end $$;
commit;

reset role;
\echo 'lakebase isolation tests: all passed'
