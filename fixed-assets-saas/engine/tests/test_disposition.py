from datetime import date
from decimal import Decimal as D

from fa_engine import (
    Asset,
    Convention,
    EntityType,
    Method,
    PropertyType,
    compute_disposition,
    depreciation_schedule,
    total_depreciation,
)

EQUIPMENT = Asset(
    asset_id="EQ-1",
    cost=D("10000"),
    placed_in_service=date(2022, 6, 1),
    recovery_years=D(5),
    method=Method.DB200,
    convention=Convention.HALF_YEAR,
)
BUILDING = Asset(
    asset_id="BLDG-1",
    cost=D("1000000"),
    placed_in_service=date(2015, 1, 15),
    recovery_years=D(39),
    method=Method.SL,
    convention=Convention.MID_MONTH,
)


def sell(asset, proceeds, *, on=date(2024, 8, 15), ptype=PropertyType.SECTION_1245, entity=EntityType.NONCORPORATE):
    return compute_disposition(asset, disposed_on=on, proceeds=D(proceeds), property_type=ptype, entity_type=entity)


def test_section_1245_gain_is_all_recapture_up_to_depreciation():
    r = sell(EQUIPMENT, "6000")
    assert r.depreciation_allowed == D("6160.00")
    assert r.adjusted_basis == D("3840.00")
    assert (r.gain_loss, r.ordinary_1245, r.section_1231) == (D("2160.00"), D("2160.00"), 0)
    assert r.form_4797_part == "III"


def test_section_1245_gain_above_cost_splits_into_1231():
    r = sell(EQUIPMENT, "12000")
    assert r.ordinary_1245 == D("6160.00")
    assert r.section_1231 == D("2000.00")


def test_loss_is_section_1231():
    r = sell(EQUIPMENT, "1000")
    assert r.gain_loss == D("-2840.00")
    assert r.section_1231 == D("-2840.00")
    assert r.form_4797_part == "I"


def test_held_one_year_or_less_is_ordinary():
    asset = Asset(**{**EQUIPMENT.__dict__, "placed_in_service": date(2024, 1, 10)})
    r = sell(asset, "9000", on=date(2024, 12, 1))
    assert r.held_more_than_one_year is False
    assert r.ordinary_short_term == D("-1000.00")
    assert r.form_4797_part == "II"


def test_straight_line_building_noncorporate_unrecaptured_1250():
    r = sell(BUILDING, "1200000", on=date(2024, 7, 10), ptype=PropertyType.SECTION_1250)
    assert r.ordinary_1250 == 0
    assert r.unrecaptured_1250 == r.depreciation_allowed
    assert r.section_1231 == r.gain_loss


def test_straight_line_building_c_corp_section_291():
    r = sell(BUILDING, "1200000", on=date(2024, 7, 10), ptype=PropertyType.SECTION_1250, entity=EntityType.C_CORP)
    assert r.ordinary_291 == (r.depreciation_allowed * D("0.20")).quantize(D("0.01"))
    assert r.unrecaptured_1250 == 0
    assert r.section_1231 == r.gain_loss - r.ordinary_291


def test_bonus_on_qip_is_additional_depreciation_under_1250():
    qip = Asset(
        asset_id="QIP-1",
        cost=D("100000"),
        placed_in_service=date(2023, 3, 1),
        recovery_years=D(15),
        method=Method.SL,
        convention=Convention.HALF_YEAR,
        bonus_rate=D("0.80"),
    )
    on = date(2025, 6, 1)
    r = sell(qip, "100000", on=on, ptype=PropertyType.SECTION_1250)
    sl_only = Asset(**{**qip.__dict__, "bonus_rate": D(0)})
    straight_line = total_depreciation(depreciation_schedule(sl_only, disposed_on=on))
    assert r.gain_loss == r.depreciation_allowed
    assert r.ordinary_1250 == r.depreciation_allowed - straight_line
    assert r.unrecaptured_1250 == straight_line
