"""Effective-dated federal rules loaded from seed CSVs.

These CSVs are the local mirror of the ``fa_rules.federal`` Delta tables in
Databricks. Rows carry a ``status`` of ``verified`` or ``verify``; the engine
uses both but surfaces ``verify`` rows so a reviewer can sign them off.
"""

from __future__ import annotations

import csv
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from functools import cache
from importlib.resources import files

from .conventions import Convention, Method


@dataclass(frozen=True)
class Section179Limit:
    tax_year: int
    dollar_limit: Decimal
    phaseout_threshold: Decimal
    suv_limit: Decimal
    citation: str
    status: str


@dataclass(frozen=True)
class BonusRule:
    rule_id: str
    acquired_on_or_after: date | None
    acquired_on_or_before: date | None
    pis_on_or_after: date | None
    pis_on_or_before: date | None
    rate: Decimal
    citation: str
    status: str

    def matches(self, acquired: date, placed_in_service: date) -> bool:
        return (
            (self.acquired_on_or_after is None or acquired >= self.acquired_on_or_after)
            and (self.acquired_on_or_before is None or acquired <= self.acquired_on_or_before)
            and (self.pis_on_or_after is None or placed_in_service >= self.pis_on_or_after)
            and (self.pis_on_or_before is None or placed_in_service <= self.pis_on_or_before)
        )


@dataclass(frozen=True)
class AssetClass:
    code: str
    description: str
    class_life: Decimal | None
    gds_years: Decimal
    ads_years: Decimal
    property_type: str
    default_method: Method
    default_convention: Convention
    citation: str


def _date(s: str) -> date | None:
    return date.fromisoformat(s) if s else None


def _rows(name: str) -> list[dict[str, str]]:
    text = files("fa_engine.ruledata").joinpath("federal", name).read_text(encoding="utf-8")
    return list(csv.DictReader(text.splitlines()))


class FederalRules:
    def __init__(
        self,
        section179: list[Section179Limit],
        bonus: list[BonusRule],
        asset_classes: list[AssetClass],
        published_tables: dict[tuple[Method, Convention, Decimal, int], list[Decimal]] | None = None,
    ) -> None:
        self._section179 = {r.tax_year: r for r in section179}
        self._bonus = bonus
        self._classes = {c.code: c for c in asset_classes}
        self._tables = published_tables or {}

    @classmethod
    @cache
    def load_default(cls) -> FederalRules:
        s179 = [
            Section179Limit(
                int(r["tax_year_beginning_in"]),
                Decimal(r["dollar_limit"]),
                Decimal(r["phaseout_threshold"]),
                Decimal(r["suv_limit"]),
                r["citation"],
                r["status"],
            )
            for r in _rows("section179_limits.csv")
        ]
        bonus = [
            BonusRule(
                r["rule_id"],
                _date(r["acquired_on_or_after"]),
                _date(r["acquired_on_or_before"]),
                _date(r["pis_on_or_after"]),
                _date(r["pis_on_or_before"]),
                Decimal(r["rate"]),
                r["citation"],
                r["status"],
            )
            for r in _rows("bonus_rates.csv")
        ]
        classes = [
            AssetClass(
                r["asset_class"],
                r["description"],
                Decimal(r["class_life"]) if r["class_life"] else None,
                Decimal(r["gds_years"]),
                Decimal(r["ads_years"]),
                r["property_type"],
                Method(r["default_method"]),
                Convention(r["default_convention"]),
                r["citation"],
            )
            for r in _rows("asset_classes.csv")
        ]
        tables: dict[tuple[Method, Convention, Decimal, int], list[Decimal]] = {}
        for r in sorted(_rows("macrs_tables.csv"), key=lambda r: int(r["recovery_year"])):
            key = (Method(r["method"]), Convention(r["convention"]), Decimal(r["recovery_years"]), int(r["placed_period"]))
            tables.setdefault(key, []).append(Decimal(r["rate_pct"]))
        return cls(s179, bonus, classes, tables)

    def published_rates(
        self, method: Method, convention: Convention, recovery_years: Decimal, placed_period: int
    ) -> list[Decimal] | None:
        """Official IRS table row, when one is loaded. ``placed_period`` is the month (MM),
        quarter (MQ) or 0 (HY) of the tax year in which the property was placed in service."""
        return self._tables.get((method, convention, Decimal(recovery_years), placed_period))

    def section179(self, tax_year: int) -> Section179Limit:
        try:
            return self._section179[tax_year]
        except KeyError:
            raise LookupError(f"no §179 limits loaded for tax year {tax_year}") from None

    def bonus_rule(self, acquired: date, placed_in_service: date) -> BonusRule | None:
        """The §168(k) rule for general qualified property, or None if no bonus applies.

        Long-production-period property, certain aircraft, specified plants and
        the P.L. 119-21 transition election (40%/60% in lieu of 100%) are not
        modeled here; pass an explicit bonus rate on the asset for those.
        """
        if acquired > placed_in_service:
            raise ValueError("acquisition date is after placed-in-service date")
        hits = [r for r in self._bonus if r.matches(acquired, placed_in_service)]
        if len(hits) > 1:
            raise LookupError(f"overlapping bonus rules: {[r.rule_id for r in hits]}")
        return hits[0] if hits else None

    def bonus_rate(self, acquired: date, placed_in_service: date) -> Decimal:
        rule = self.bonus_rule(acquired, placed_in_service)
        return rule.rate if rule else Decimal(0)

    def asset_class(self, code: str) -> AssetClass:
        return self._classes[code]
