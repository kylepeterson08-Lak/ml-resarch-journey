from datetime import date
from decimal import Decimal as D

import pytest

from fa_engine import Asset, Convention, FederalRules, Method, depreciation_schedule, mid_quarter_applies
from fa_engine.depreciation import total_depreciation


def equipment(**kw) -> Asset:
    base = dict(
        asset_id="EQ-1",
        cost=D("10000"),
        placed_in_service=date(2022, 6, 1),
        recovery_years=D(5),
        method=Method.DB200,
        convention=Convention.HALF_YEAR,
    )
    base.update(kw)
    return Asset(**base)


def test_seven_year_half_year_schedule():
    rows = depreciation_schedule(equipment(recovery_years=D(7), placed_in_service=date(2024, 4, 1)))
    assert [r.tax_year for r in rows] == list(range(2024, 2032))
    assert rows[0].depreciation == D("1429.00")
    assert rows[-1].depreciation == D("446.00")
    assert total_depreciation(rows) == D("10000")
    assert rows[-1].net_book_value == 0


def test_bonus_after_section_179_then_macrs():
    rows = depreciation_schedule(
        equipment(cost=D("100000"), recovery_years=D(7), section_179=D("30000"), bonus_rate=D("0.60"))
    )
    first = rows[0]
    assert (first.section_179, first.bonus, first.depreciation) == (D("30000"), D("42000.00"), D("4001.20"))
    assert total_depreciation(rows) == D("100000")


def test_obbba_full_expensing_leaves_nothing_for_macrs():
    rules = FederalRules.load_default()
    rate = rules.bonus_rate(date(2025, 3, 1), date(2025, 3, 1))
    rows = depreciation_schedule(equipment(cost=D("100000"), placed_in_service=date(2025, 3, 1), bonus_rate=rate))
    assert rows[0].bonus == D("100000.00")
    assert all(r.depreciation == 0 for r in rows)


def test_pre_cutoff_binding_contract_gets_forty_percent():
    rules = FederalRules.load_default()
    rate = rules.bonus_rate(date(2024, 12, 15), date(2025, 2, 1))
    rows = depreciation_schedule(
        equipment(cost=D("50000"), acquired=date(2024, 12, 15), placed_in_service=date(2025, 2, 1), bonus_rate=rate)
    )
    assert rows[0].bonus == D("20000.00")
    assert rows[0].depreciation == D("6000.00")


def test_half_year_disposal_gets_half_of_full_year():
    rows = depreciation_schedule(equipment(), disposed_on=date(2024, 8, 15))
    assert [r.depreciation for r in rows] == [D("2000.00"), D("3200.00"), D("960.00")]


def test_mid_quarter_disposal_in_second_quarter():
    asset = equipment(placed_in_service=date(2022, 11, 1), convention=Convention.MID_QUARTER)
    rows = depreciation_schedule(asset, disposed_on=date(2024, 5, 10))
    # Year-3 table rate 22.80% x 4.5/12 (Pub 946: 37.5% for a 2nd-quarter disposal).
    assert rows[-1].depreciation == D("855.00")


def test_disposal_in_placed_in_service_year_gets_no_depreciation_or_bonus():
    rows = depreciation_schedule(
        equipment(placed_in_service=date(2024, 2, 1), bonus_rate=D("0.60")), disposed_on=date(2024, 11, 1)
    )
    assert len(rows) == 1
    assert rows[0].bonus == 0 and rows[0].depreciation == 0


def test_disposal_after_recovery_period_keeps_full_schedule():
    rows = depreciation_schedule(equipment(), disposed_on=date(2030, 1, 15))
    assert total_depreciation(rows) == D("10000")


def test_disposal_in_final_half_year_gets_full_residual():
    # The 6th-year residual already reflects the half-year convention.
    rows = depreciation_schedule(equipment(), disposed_on=date(2027, 9, 30))
    assert rows[-1].depreciation == D("576.00")


def test_nonresidential_real_property_formula_vs_table():
    building = Asset(
        asset_id="BLDG-1",
        cost=D("1000000"),
        placed_in_service=date(2024, 1, 15),
        recovery_years=D(39),
        method=Method.SL,
        convention=Convention.MID_MONTH,
    )
    assert depreciation_schedule(building, use_tables=False)[0].depreciation == D("24572.65")
    # Table mode uses the published Table A-7a row (2.461%), not the generated 2.457%.
    rows = depreciation_schedule(building)
    assert rows[0].depreciation == D("24610.00")
    assert rows[1].depreciation == D("25640.00")
    assert len(rows) == 40 and total_depreciation(rows) == D("1000000")


def test_fiscal_year_mid_quarter():
    # July-June fiscal year: September is in the first quarter.
    asset = equipment(placed_in_service=date(2024, 9, 10), convention=Convention.MID_QUARTER, fy_start_month=7)
    rows = depreciation_schedule(asset)
    assert rows[0].tax_year == 2024
    assert rows[0].rate_pct == D("35.00")


def test_business_use_reduces_basis():
    rows = depreciation_schedule(equipment(business_use=D("0.80")))
    assert rows[0].depreciation == D("1600.00")
    assert total_depreciation(rows) == D("8000.00")


def test_expensing_requires_majority_business_use():
    with pytest.raises(ValueError):
        depreciation_schedule(equipment(business_use=D("0.50"), bonus_rate=D("0.60")))


@pytest.mark.parametrize(
    ("items", "expected"),
    [
        ([(date(2024, 3, 1), D("50000")), (date(2024, 11, 1), D("60000"))], True),
        ([(date(2024, 3, 1), D("70000")), (date(2024, 10, 15), D("30000"))], False),
        ([(date(2024, 3, 1), D("60000")), (date(2024, 12, 1), D("40000"))], False),  # exactly 40%
    ],
)
def test_mid_quarter_forty_percent_test(items, expected):
    assert mid_quarter_applies(items) is expected
