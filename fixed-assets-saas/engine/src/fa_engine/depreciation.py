"""Per-asset MACRS schedules with §179, bonus, and year-of-disposition handling.

Order of basis reductions follows Pub 946: business-use basis, then §179,
then bonus (§168(k)) on what remains, then regular MACRS on the remainder.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from .conventions import (
    Convention,
    Method,
    first_year_months,
    month_index,
    months_to_convention_point,
    tax_year_of,
)
from .macrs import recovery_fractions, table_precision, table_rates, year_months
from .rules import FederalRules

CENT = Decimal("0.01")
ZERO = Decimal(0)


def money(x: Decimal) -> Decimal:
    return x.quantize(CENT, rounding=ROUND_HALF_UP)


@dataclass(frozen=True)
class Asset:
    asset_id: str
    cost: Decimal
    placed_in_service: date
    recovery_years: Decimal
    method: Method
    convention: Convention
    acquired: date | None = None
    business_use: Decimal = Decimal(1)
    section_179: Decimal = ZERO
    bonus_rate: Decimal = ZERO
    fy_start_month: int = 1

    @property
    def acquisition_date(self) -> date:
        return self.acquired or self.placed_in_service

    @property
    def business_basis(self) -> Decimal:
        return money(self.cost * self.business_use)


@dataclass(frozen=True)
class ScheduleRow:
    tax_year: int
    months: Decimal
    rate_pct: Decimal
    section_179: Decimal
    bonus: Decimal
    depreciation: Decimal
    accumulated: Decimal
    net_book_value: Decimal

    @property
    def total_expense(self) -> Decimal:
        return self.section_179 + self.bonus + self.depreciation


def _validate(asset: Asset) -> None:
    if asset.cost < 0:
        raise ValueError("cost must be non-negative")
    if not 0 < asset.business_use <= 1:
        raise ValueError("business_use must be in (0, 1]")
    if not 0 <= asset.bonus_rate <= 1:
        raise ValueError("bonus_rate must be in [0, 1]")
    if not 0 <= asset.section_179 <= asset.business_basis:
        raise ValueError("§179 must be between 0 and business-use basis")
    if asset.business_use <= Decimal("0.5") and (asset.section_179 or asset.bonus_rate):
        # §280F(d)(1) / §179(d)(10): qualified business use must exceed 50%.
        raise ValueError("§179 and bonus require more than 50% business use")
    if asset.method is not Method.SL and asset.convention is Convention.MID_MONTH:
        raise ValueError("mid-month convention applies only to SL real property")


def _placed_period(asset: Asset) -> int:
    """Column of the IRS table: month (MM) or quarter (MQ) of the tax year; 0 for HY."""
    m = month_index(asset.placed_in_service, asset.fy_start_month)
    if asset.convention is Convention.MID_MONTH:
        return m + 1
    if asset.convention is Convention.MID_QUARTER:
        return m // 3 + 1
    return 0


def depreciation_schedule(
    asset: Asset,
    *,
    use_tables: bool = True,
    disposed_on: date | None = None,
    rules: FederalRules | None = None,
) -> list[ScheduleRow]:
    """Year-by-year schedule; truncated at the disposal year when ``disposed_on`` is set."""
    _validate(asset)
    pis_year = tax_year_of(asset.placed_in_service, asset.fy_start_month)
    disposal_index = None
    if disposed_on is not None:
        if disposed_on < asset.placed_in_service:
            raise ValueError("disposal precedes placed-in-service date")
        disposal_index = tax_year_of(disposed_on, asset.fy_start_month) - pis_year

    basis = asset.business_basis
    s179 = money(asset.section_179)
    # Reg. 1.168(k)-1(f)(1): no bonus for property placed in service and disposed of in the same year.
    same_year_disposal = disposal_index == 0
    bonus = ZERO if same_year_disposal else money((basis - s179) * asset.bonus_rate)
    depreciable = basis - s179 - bonus

    fym = first_year_months(asset.convention, asset.placed_in_service, asset.fy_start_month)
    fractions = recovery_fractions(asset.method, asset.recovery_years, fym)
    months = year_months(asset.recovery_years, fym)
    if use_tables:
        # Prefer the official table row; some (e.g. 39-year Table A-7a) were not built by formula.
        rates = (rules or FederalRules.load_default()).published_rates(
            asset.method, asset.convention, asset.recovery_years, _placed_period(asset)
        ) or table_rates(
            asset.method,
            asset.recovery_years,
            fym,
            table_precision(asset.recovery_years, asset.convention is Convention.MID_MONTH),
        )
    else:
        rates = [f * 100 for f in fractions]

    amounts = [money(depreciable * r / 100) for r in rates]
    amounts[-1] = depreciable - sum(amounts[:-1], ZERO)

    if disposal_index is not None:
        if same_year_disposal:
            amounts = [ZERO]
        elif disposal_index < len(amounts):
            k = disposal_index
            m_d = months_to_convention_point(asset.convention, disposed_on, asset.fy_start_month)
            amounts = amounts[:k] + [money(amounts[k] * min(m_d, months[k]) / months[k])]
        # disposal after the recovery period: full schedule, nothing in the disposal year

    rows: list[ScheduleRow] = []
    accumulated = ZERO
    for i, amount in enumerate(amounts):
        y179 = s179 if i == 0 else ZERO
        ybonus = bonus if i == 0 else ZERO
        accumulated += y179 + ybonus + amount
        rows.append(
            ScheduleRow(
                tax_year=pis_year + i,
                months=months[i] if i < len(months) else ZERO,
                rate_pct=rates[i] if i < len(rates) else ZERO,
                section_179=y179,
                bonus=ybonus,
                depreciation=amount,
                accumulated=accumulated,
                net_book_value=basis - accumulated,
            )
        )
    return rows


def total_depreciation(rows: list[ScheduleRow]) -> Decimal:
    return rows[-1].accumulated if rows else ZERO
