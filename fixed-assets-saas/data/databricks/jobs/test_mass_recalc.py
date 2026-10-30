from datetime import date
from decimal import Decimal as D

import pandas as pd

from fa_engine import Asset, Convention, Method, depreciation_schedule
from mass_recalc import run_entity_year


def frame(rows):
    base = dict(tenant_id="t1", entity_id="e1", book_id="fed", method="200DB", section_179="0", bonus_rate="0")
    return pd.DataFrame([{**base, **r} for r in rows])


def test_matches_engine_called_directly():
    pdf = frame([dict(asset_id="a1", placed_in_service_on="2024-03-01", recovery_months=84, convention="HY", basis="10000")])
    out = run_entity_year(pdf)
    direct = depreciation_schedule(
        Asset("a1", D("10000"), date(2024, 3, 1), D(7), Method.DB200, Convention.HALF_YEAR)
    )
    assert list(out["depreciation"]) == [str(r.depreciation) for r in direct]


def test_q4_heavy_year_flips_every_personal_asset_to_mid_quarter():
    pdf = frame(
        [
            dict(asset_id="march", placed_in_service_on="2024-03-01", recovery_months=60, convention="HY", basis="40000"),
            dict(asset_id="nov", placed_in_service_on="2024-11-15", recovery_months=60, convention="HY", basis="60000"),
            dict(asset_id="bldg", placed_in_service_on="2024-11-15", recovery_months=468, convention="MM",
                 basis="500000", method="SL"),
        ]
    )
    out = run_entity_year(pdf)
    first = out[out["tax_year"] == 2024].set_index("asset_id")
    assert first.loc["march", "convention"] == "MQ" and first.loc["march", "rate_pct"] == "35.00"
    assert first.loc["nov", "convention"] == "MQ" and first.loc["nov", "rate_pct"] == "5.00"
    assert first.loc["bldg", "convention"] == "MM"  # real property is outside the 40% test
