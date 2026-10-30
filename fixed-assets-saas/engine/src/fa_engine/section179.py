"""Taxpayer-level §179 limitation, mirroring Form 4562 Part I lines 1-13."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from .depreciation import ZERO, money
from .rules import FederalRules


@dataclass(frozen=True)
class Section179Computation:
    line1_max_amount: Decimal
    line2_total_cost: Decimal
    line3_threshold: Decimal
    line4_reduction: Decimal
    line5_dollar_limitation: Decimal
    line8_elected_cost: Decimal
    line9_tentative: Decimal
    line10_carryover_in: Decimal
    line11_business_income_limit: Decimal
    line12_deduction: Decimal
    line13_carryover_out: Decimal
    rule_status: str


def compute_section179(
    tax_year: int,
    *,
    total_cost_placed_in_service: Decimal,
    elected_cost: Decimal,
    business_income: Decimal,
    carryover_in: Decimal = ZERO,
    rules: FederalRules | None = None,
) -> Section179Computation:
    """Apply the dollar limit, the investment phase-out, and the taxable-income limit.

    Married-filing-separately splits and the enterprise-zone / SUV caps are
    applied per asset upstream, not here.
    """
    if elected_cost > total_cost_placed_in_service:
        raise ValueError("elected cost exceeds cost of §179 property placed in service")
    limits = (rules or FederalRules.load_default()).section179(tax_year)
    line4 = max(ZERO, total_cost_placed_in_service - limits.phaseout_threshold)
    line5 = max(ZERO, limits.dollar_limit - line4)
    line9 = min(line5, elected_cost)
    line11 = max(ZERO, min(business_income, line5))
    line12 = min(line9 + carryover_in, line11)
    return Section179Computation(
        line1_max_amount=limits.dollar_limit,
        line2_total_cost=money(total_cost_placed_in_service),
        line3_threshold=limits.phaseout_threshold,
        line4_reduction=money(line4),
        line5_dollar_limitation=money(line5),
        line8_elected_cost=money(elected_cost),
        line9_tentative=money(line9),
        line10_carryover_in=money(carryover_in),
        line11_business_income_limit=money(line11),
        line12_deduction=money(line12),
        line13_carryover_out=money(line9 + carryover_in - line12),
        rule_status=limits.status,
    )
