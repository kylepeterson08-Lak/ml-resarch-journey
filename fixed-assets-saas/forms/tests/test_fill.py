from decimal import Decimal as D

from fa_engine import compute_section179
from fill import fill, section179_facts


def test_form_4562_part_i_from_engine_facts():
    comp = compute_section179(
        2025,
        total_cost_placed_in_service=D("4200000.40"),
        elected_cost=D("1500000.50"),
        business_income=D("900000"),
    )
    lines = {l.line_no: l for l in fill("US-IRS-4562", "2025", section179_facts(comp))}
    assert lines["1"].value == D("2500000")
    assert lines["4"].value == D("200000")  # 4,200,000.40 - 4,000,000, whole dollars
    assert lines["9"].value == D("1500001")  # 1,500,000.50 rounds up
    assert lines["12"].value == D("900000")
    assert lines["13"].value == D("600001")
    assert lines["14"].value is None  # not supplied: left blank, never guessed
    assert all(l.status == "verify" for l in lines.values())
