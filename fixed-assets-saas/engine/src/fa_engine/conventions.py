"""MACRS methods, conventions, and tax-year timing.

All timing is expressed in months from the start of the tax year to the
convention point, so one code path serves calendar and fiscal 12-month years.
Short tax years (Rev. Proc. 89-15) are not supported yet.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from enum import Enum


class Method(str, Enum):
    DB200 = "200DB"
    DB150 = "150DB"
    SL = "SL"

    @property
    def db_factor(self) -> Decimal | None:
        return {Method.DB200: Decimal(2), Method.DB150: Decimal("1.5")}.get(self)


class Convention(str, Enum):
    HALF_YEAR = "HY"
    MID_QUARTER = "MQ"
    MID_MONTH = "MM"


def month_index(d: date, fy_start_month: int = 1) -> int:
    """0-based month of the tax year that contains ``d``."""
    return (d.month - fy_start_month) % 12


def tax_year_of(d: date, fy_start_month: int = 1) -> int:
    """Tax year label = calendar year in which the tax year begins."""
    return d.year if d.month >= fy_start_month else d.year - 1


def months_to_convention_point(
    convention: Convention, d: date, fy_start_month: int = 1
) -> Decimal:
    """Months from the start of the tax year to the deemed date of the event.

    HY: midpoint of the year. MQ: midpoint of the quarter containing ``d``.
    MM: midpoint of the month containing ``d``.
    """
    if convention is Convention.HALF_YEAR:
        return Decimal(6)
    m = month_index(d, fy_start_month)
    if convention is Convention.MID_QUARTER:
        return Decimal(3 * (m // 3)) + Decimal("1.5")
    return Decimal(m) + Decimal("0.5")


def first_year_months(convention: Convention, placed_in_service: date, fy_start_month: int = 1) -> Decimal:
    """Months of recovery allowed in the placed-in-service year."""
    return Decimal(12) - months_to_convention_point(convention, placed_in_service, fy_start_month)


def mid_quarter_applies(
    placed_in_service: list[tuple[date, Decimal]], fy_start_month: int = 1
) -> bool:
    """40% test of §168(d)(3) / Reg. 1.168(d)-1(b).

    ``placed_in_service`` is (date, depreciable basis) for every item of
    personal property placed in service in the tax year. Callers must exclude
    residential rental / nonresidential real property and property placed in
    service and disposed of in the same year, and must pass basis after §179
    but *before* bonus depreciation (bonus is disregarded for this test).
    """
    total = sum((basis for _, basis in placed_in_service), Decimal(0))
    if total <= 0:
        return False
    last_quarter = sum(
        (basis for d, basis in placed_in_service if month_index(d, fy_start_month) >= 9),
        Decimal(0),
    )
    return last_quarter > total * Decimal("0.40")
