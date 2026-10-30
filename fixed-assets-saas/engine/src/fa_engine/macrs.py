"""MACRS rate generation (Rev. Proc. 87-57 formula) and IRS-style table rates.

``recovery_fractions`` is the exact formula: declining balance with a switch
to straight line in the first year SL >= DB, run month-by-month against the
recovery period so HY, MQ and MM all fall out of the first-year months.

``table_rates`` rebuilds the Pub 946 percentage tables the way they were
built: each year's rate is computed on the *rounded* remaining percentage
and rounded to the table's precision, with the last year taking the
remainder. Rounding the cumulative total instead does not reproduce the
10-year or 27.5-year tables. Published tables loaded as rules data take
precedence over generated ones.
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

from .conventions import Method


def recovery_fractions(
    method: Method, recovery_years: Decimal, first_year_months: Decimal
) -> list[Decimal]:
    """Unrounded fraction of depreciable basis recovered in each tax year."""
    recovery_years = Decimal(recovery_years)
    if recovery_years <= 0:
        raise ValueError("recovery period must be positive")
    if not 0 < first_year_months <= 12:
        raise ValueError("first-year months must be in (0, 12]")

    factor = method.db_factor
    db_rate = factor / recovery_years if factor is not None else None
    remaining = Decimal(1)
    remaining_months = recovery_years * 12
    months = Decimal(first_year_months)
    out: list[Decimal] = []
    while remaining_months > 0:
        months = min(months, remaining_months)
        amount = remaining * months / remaining_months
        if db_rate is not None:
            amount = max(amount, remaining * db_rate * months / 12)
        amount = min(amount, remaining)
        out.append(amount)
        remaining -= amount
        remaining_months -= months
        months = Decimal(12)
    return out


def year_months(recovery_years: Decimal, first_year_months: Decimal) -> list[Decimal]:
    """Months of recovery falling in each tax year (parallel to the fractions)."""
    remaining = Decimal(recovery_years) * 12
    months = Decimal(first_year_months)
    out: list[Decimal] = []
    while remaining > 0:
        months = min(months, remaining)
        out.append(months)
        remaining -= months
        months = Decimal(12)
    return out


def table_precision(recovery_years: Decimal, real_property: bool) -> int:
    """Decimal places used by Pub 946 Tables A-1 to A-7a (2, or 3 for 20-year and real property)."""
    return 3 if real_property or Decimal(recovery_years) >= 20 else 2


def table_rates(
    method: Method, recovery_years: Decimal, first_year_months: Decimal, places: int = 2
) -> list[Decimal]:
    """Percentages per tax year, rounded as in the IRS tables; they sum to exactly 100."""
    recovery_years = Decimal(recovery_years)
    q = Decimal(1).scaleb(-places)
    factor = method.db_factor
    db_rate = factor / recovery_years if factor is not None else None
    remaining = Decimal(100)
    remaining_months = recovery_years * 12
    months = Decimal(first_year_months)
    rates: list[Decimal] = []
    while remaining_months > 0:
        months = min(months, remaining_months)
        if months == remaining_months:
            rate = remaining
        else:
            rate = remaining * months / remaining_months
            if db_rate is not None:
                rate = max(rate, remaining * db_rate * months / 12)
            rate = min(rate.quantize(q, rounding=ROUND_HALF_UP), remaining)
        rates.append(rate)
        remaining -= rate
        remaining_months -= months
        months = Decimal(12)
    return rates
