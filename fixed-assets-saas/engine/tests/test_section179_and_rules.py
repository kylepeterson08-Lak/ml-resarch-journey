from datetime import date
from decimal import Decimal as D

import pytest

from fa_engine import FederalRules, compute_section179


def test_phaseout_reduces_dollar_limit():
    r = compute_section179(
        2024, total_cost_placed_in_service=D("3100000"), elected_cost=D("1220000"), business_income=D("5000000")
    )
    assert r.line4_reduction == D("50000.00")
    assert r.line5_dollar_limitation == D("1170000.00")
    assert r.line12_deduction == D("1170000.00")
    assert r.line13_carryover_out == 0


def test_business_income_limit_creates_carryover():
    r = compute_section179(
        2024, total_cost_placed_in_service=D("500000"), elected_cost=D("500000"), business_income=D("200000")
    )
    assert r.line12_deduction == D("200000.00")
    assert r.line13_carryover_out == D("300000.00")


def test_carryover_in_is_used_first_against_income_limit():
    r = compute_section179(
        2024,
        total_cost_placed_in_service=D("100000"),
        elected_cost=D("100000"),
        business_income=D("250000"),
        carryover_in=D("300000"),
    )
    assert r.line12_deduction == D("250000.00")
    assert r.line13_carryover_out == D("150000.00")


def test_obbba_2025_limits_and_full_phaseout():
    r = compute_section179(
        2025, total_cost_placed_in_service=D("4500000"), elected_cost=D("2500000"), business_income=D("9000000")
    )
    assert r.line1_max_amount == D("2500000")
    assert r.line5_dollar_limitation == D("2000000.00")
    zero = compute_section179(
        2025, total_cost_placed_in_service=D("7000000"), elected_cost=D("1000000"), business_income=D("9000000")
    )
    assert zero.line12_deduction == 0


def test_unverified_rows_are_flagged():
    assert FederalRules.load_default().section179(2026).status == "verify"


@pytest.mark.parametrize(
    ("acquired", "pis", "rate"),
    [
        (date(2017, 9, 27), date(2018, 3, 1), D("0.40")),  # pre-TCJA acquisition
        (date(2017, 9, 28), date(2017, 10, 2), D("1.00")),
        (date(2023, 5, 1), date(2023, 5, 1), D("0.80")),
        (date(2024, 7, 1), date(2024, 7, 1), D("0.60")),
        (date(2025, 1, 19), date(2025, 3, 1), D("0.40")),  # acquired before the P.L. 119-21 cutoff
        (date(2025, 1, 20), date(2025, 3, 1), D("1.00")),
        (date(2024, 6, 1), date(2026, 6, 1), D("0.20")),
        (date(2024, 6, 1), date(2027, 6, 1), D("0")),
        (date(2030, 6, 1), date(2030, 6, 1), D("1.00")),  # permanent after P.L. 119-21
    ],
)
def test_bonus_rate_by_acquisition_and_service_dates(acquired, pis, rate):
    assert FederalRules.load_default().bonus_rate(acquired, pis) == rate


def test_asset_class_lookup():
    computers = FederalRules.load_default().asset_class("00.12")
    assert (computers.gds_years, computers.ads_years) == (D(5), D(5))
    assert FederalRules.load_default().asset_class("NONRES_REAL").gds_years == D(39)
