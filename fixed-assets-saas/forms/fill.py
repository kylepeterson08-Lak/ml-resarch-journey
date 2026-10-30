"""Map engine facts to form lines by semantic key.

The form layer never computes tax: every value is an engine fact keyed by
meaning (``s179.deduction``), and the form definition for a revision says which
line carries it. A line renumbered in a new revision is a data change only.
PDF field names and e-file XPaths are filled in by the forms swarm per revision.
"""

from __future__ import annotations

import csv
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

DEFINITIONS = Path(__file__).parent / "definitions"


@dataclass(frozen=True)
class FilledLine:
    line_no: str
    caption: str
    semantic_key: str
    value: Decimal | None
    pdf_field: str
    status: str


def load_definition(form_id: str, revision: str) -> list[dict[str, str]]:
    with open(DEFINITIONS / form_id / f"{revision}.csv", newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def _round(value: Decimal, rule: str) -> Decimal:
    if rule == "WHOLE_DOLLAR":  # IRS: drop under 50 cents, round 50-99 cents up
        return value.quantize(Decimal(1), rounding=ROUND_HALF_UP)
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def fill(form_id: str, revision: str, facts: dict[str, Decimal]) -> list[FilledLine]:
    lines = []
    for d in load_definition(form_id, revision):
        raw = facts.get(d["semantic_key"])
        lines.append(
            FilledLine(
                line_no=d["line_no"],
                caption=d["caption"],
                semantic_key=d["semantic_key"],
                value=None if raw is None else _round(raw, d["rounding"]),
                pdf_field=d["pdf_field"],
                status=d["status"],
            )
        )
    return lines


def section179_facts(c) -> dict[str, Decimal]:
    """Facts from ``fa_engine.Section179Computation``."""
    return {
        "s179.max_amount": c.line1_max_amount,
        "s179.total_cost": c.line2_total_cost,
        "s179.threshold": c.line3_threshold,
        "s179.reduction": c.line4_reduction,
        "s179.dollar_limitation": c.line5_dollar_limitation,
        "s179.elected_cost": c.line8_elected_cost,
        "s179.tentative": c.line9_tentative,
        "s179.carryover_in": c.line10_carryover_in,
        "s179.business_income_limit": c.line11_business_income_limit,
        "s179.deduction": c.line12_deduction,
        "s179.carryover_out": c.line13_carryover_out,
    }
