"""Dispositions: adjusted basis, gain/loss, and character (§1245, §1250, §291, §1231).

Scope: the business-use portion of a single asset disposed of in one event.
Partial dispositions (Reg. 1.168(i)-8), general asset accounts, installment
sales, §1031/§1033 deferral, and the §1231 five-year lookback are taxpayer-
level steps layered on top of this result.
"""

from __future__ import annotations

from dataclasses import dataclass, replace
from datetime import date
from decimal import Decimal
from enum import Enum

from .conventions import Method, tax_year_of
from .depreciation import ZERO, Asset, depreciation_schedule, money, total_depreciation


class PropertyType(str, Enum):
    SECTION_1245 = "1245"
    SECTION_1250 = "1250"


class EntityType(str, Enum):
    C_CORP = "C_CORP"
    NONCORPORATE = "NONCORPORATE"  # individuals, partnerships, and most S corporations


class DispositionKind(str, Enum):
    SALE = "SALE"
    EXCHANGE = "EXCHANGE"
    RETIREMENT = "RETIREMENT"
    ABANDONMENT = "ABANDONMENT"
    CASUALTY = "CASUALTY"  # computed on Form 4684 first, then flows to Form 4797


@dataclass(frozen=True)
class DispositionResult:
    disposed_on: date
    kind: DispositionKind
    amount_realized: Decimal
    depreciation_allowed: Decimal
    disposal_year_depreciation: Decimal
    adjusted_basis: Decimal
    gain_loss: Decimal
    held_more_than_one_year: bool
    ordinary_1245: Decimal
    ordinary_1250: Decimal
    ordinary_291: Decimal
    unrecaptured_1250: Decimal
    section_1231: Decimal
    ordinary_short_term: Decimal

    @property
    def form_4797_part(self) -> str:
        if not self.held_more_than_one_year:
            return "II"
        if self.gain_loss > 0 and (self.ordinary_1245 or self.ordinary_1250 or self.ordinary_291 or self.unrecaptured_1250):
            return "III"
        return "I"


def _held_more_than_one_year(acquired: date, disposed_on: date) -> bool:
    try:
        anniversary = acquired.replace(year=acquired.year + 1)
    except ValueError:  # Feb 29
        anniversary = acquired.replace(year=acquired.year + 1, day=28)
    return disposed_on > anniversary


def compute_disposition(
    asset: Asset,
    *,
    disposed_on: date,
    proceeds: Decimal,
    selling_expenses: Decimal = ZERO,
    property_type: PropertyType,
    entity_type: EntityType,
    kind: DispositionKind = DispositionKind.SALE,
    use_tables: bool = True,
) -> DispositionResult:
    rows = depreciation_schedule(asset, use_tables=use_tables, disposed_on=disposed_on)
    allowed = total_depreciation(rows)
    s179 = rows[0].section_179
    adjusted_basis = asset.business_basis - allowed
    amount_realized = money(proceeds - selling_expenses)
    gain = amount_realized - adjusted_basis
    long_term = _held_more_than_one_year(asset.acquisition_date, disposed_on)

    ord_1245 = ord_1250 = ord_291 = unrecaptured = s1231 = short_term = ZERO
    if not long_term:
        short_term = gain
    elif gain <= 0:
        s1231 = gain
    elif property_type is PropertyType.SECTION_1245:
        ord_1245 = min(gain, allowed)
        s1231 = gain - ord_1245
    else:
        # §179 taken on real property is recaptured as if §1245 property (§1245(a)(3)(C)).
        ord_1245 = min(gain, s179)
        sl_asset = replace(
            asset,
            cost=asset.business_basis - s179,
            business_use=Decimal(1),
            section_179=ZERO,
            bonus_rate=ZERO,
            method=Method.SL,
        )
        straight_line = total_depreciation(
            depreciation_schedule(sl_asset, use_tables=use_tables, disposed_on=disposed_on)
        )
        additional = max(ZERO, allowed - s179 - straight_line)
        ord_1250 = min(gain - ord_1245, additional)
        if entity_type is EntityType.C_CORP:
            would_be_1245 = min(gain, allowed)
            ord_291 = money(Decimal("0.20") * max(ZERO, would_be_1245 - ord_1245 - ord_1250))
        else:
            unrecaptured = min(gain - ord_1245 - ord_1250, allowed - s179 - ord_1250)
        s1231 = gain - ord_1245 - ord_1250 - ord_291

    return DispositionResult(
        disposed_on=disposed_on,
        kind=kind,
        amount_realized=amount_realized,
        depreciation_allowed=allowed,
        disposal_year_depreciation=rows[-1].depreciation if rows[-1].tax_year == tax_year_of(disposed_on, asset.fy_start_month) else ZERO,
        adjusted_basis=adjusted_basis,
        gain_loss=gain,
        held_more_than_one_year=long_term,
        ordinary_1245=ord_1245,
        ordinary_1250=ord_1250,
        ordinary_291=ord_291,
        unrecaptured_1250=unrecaptured,
        section_1231=s1231,
        ordinary_short_term=short_term,
    )

