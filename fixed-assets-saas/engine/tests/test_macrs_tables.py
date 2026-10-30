"""Generated rates vs. IRS Pub 946 Appendix A tables (Rev. Proc. 87-57)."""

from decimal import Decimal as D

import pytest

from fa_engine.conventions import Method
from fa_engine.macrs import recovery_fractions, table_rates


def pct(*xs: str) -> list[D]:
    return [D(x) for x in xs]


@pytest.mark.parametrize(
    ("years", "method", "first_months", "places", "expected"),
    [
        # Table A-1, half-year convention
        (3, Method.DB200, 6, 2, pct("33.33", "44.45", "14.81", "7.41")),
        (5, Method.DB200, 6, 2, pct("20.00", "32.00", "19.20", "11.52", "11.52", "5.76")),
        (7, Method.DB200, 6, 2, pct("14.29", "24.49", "17.49", "12.49", "8.93", "8.92", "8.93", "4.46")),
        (
            10, Method.DB200, 6, 2,
            pct("10.00", "18.00", "14.40", "11.52", "9.22", "7.37", "6.55", "6.55", "6.56", "6.55", "3.28"),
        ),
        (
            15, Method.DB150, 6, 2,
            pct("5.00", "9.50", "8.55", "7.70", "6.93", "6.23", "5.90", "5.90",
                "5.91", "5.90", "5.91", "5.90", "5.91", "5.90", "5.91", "2.95"),
        ),
        # Table A-2 / A-5, mid-quarter convention (1st and 4th quarter)
        (5, Method.DB200, D("10.5"), 2, pct("35.00", "26.00", "15.60", "11.01", "11.01", "1.38")),
        (5, Method.DB200, D("1.5"), 2, pct("5.00", "38.00", "22.80", "13.68", "10.94", "9.58")),
        (7, Method.DB200, D("1.5"), 2, pct("3.57", "27.55", "19.68", "14.06", "10.04", "8.73", "8.73", "7.64")),
    ],
)
def test_personal_property_tables(years, method, first_months, places, expected):
    assert table_rates(method, D(years), D(first_months), places) == expected


def test_twenty_year_half_year_three_decimals():
    rates = table_rates(Method.DB150, D(20), D(6), 3)
    assert rates[:9] == pct("3.750", "7.219", "6.677", "6.177", "5.713", "5.285", "4.888", "4.522", "4.462")
    assert rates[-1] == D("2.231")
    assert len(rates) == 21


def test_residential_rental_january():
    # Table A-6: 27.5-year, mid-month, placed in service in January.
    rates = table_rates(Method.SL, D("27.5"), D("11.5"), 3)
    assert rates[0] == D("3.485")
    assert rates[1:9] == [D("3.636")] * 8
    assert rates[9] == D("3.637")
    assert rates[27] == D("1.970")
    assert len(rates) == 28


@pytest.mark.parametrize("years", [3, 5, 7, 10, 15, 20, D("27.5"), 39])
def test_tables_sum_to_100(years):
    for first in (D("1.5"), D("4.5"), D("6"), D("7.5"), D("10.5"), D("11.5")):
        assert sum(table_rates(Method.SL, D(years), first, 3)) == 100


def test_formula_fractions_sum_to_one():
    for method in Method:
        for first in (D("0.5"), D("6"), D("10.5")):
            assert abs(sum(recovery_fractions(method, D(7), first)) - 1) < D("1e-20")


def test_nonresidential_formula_first_year():
    # 39-year SL, January, mid-month: 11.5 / 12 / 39 of basis.
    f = recovery_fractions(Method.SL, D(39), D("11.5"))
    assert f[0] == D("11.5") / 12 / 39
    assert len(f) == 40
