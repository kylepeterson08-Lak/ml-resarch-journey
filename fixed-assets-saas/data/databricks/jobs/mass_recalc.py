"""Fleet / entity-year recalculation on Databricks.

``run_entity_year`` is a pure pandas function: Spark calls it once per
(tenant, entity, book) group via ``applyInPandas``, and the online calc service
calls the same ``fa_engine`` code for what-ifs, so batch and interactive results
come from one code path. Money crosses the Arrow boundary as strings to keep
Decimal exactness.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pandas as pd

from fa_engine import Asset, Convention, FederalRules, Method, depreciation_schedule, mid_quarter_applies

ENGINE_VERSION = "fa_engine-0.1.0"

OUTPUT_SCHEMA = (
    "tenant_id string, entity_id string, asset_id string, book_id string, tax_year int, "
    "months string, rate_pct string, section_179 string, bonus string, depreciation string, "
    "accumulated string, net_book_value string, convention string"
)


def _d(x) -> Decimal:
    return Decimal(str(x))


def run_entity_year(pdf: pd.DataFrame, rules: FederalRules | None = None) -> pd.DataFrame:
    """Schedules for every asset of one (tenant, entity, book).

    Entity-level step first: the mid-quarter test decides the convention for
    personal property placed in service in each tax year; then per-asset schedules.
    """
    rules = rules or FederalRules.load_default()
    pdf = pdf.copy()
    pdf["placed_in_service_on"] = pd.to_datetime(pdf["placed_in_service_on"]).dt.date

    mq_years: set[int] = set()
    personal = pdf[pdf["convention"] != "MM"]
    for year, grp in personal.groupby(personal["placed_in_service_on"].map(lambda d: d.year)):
        items = [(r.placed_in_service_on, _d(r.basis) - _d(r.section_179)) for r in grp.itertuples()]
        if mid_quarter_applies(items):
            mq_years.add(year)

    out = []
    for r in pdf.itertuples():
        pis: date = r.placed_in_service_on
        convention = Convention(r.convention)
        if convention is not Convention.MID_MONTH and pis.year in mq_years:
            convention = Convention.MID_QUARTER
        asset = Asset(
            asset_id=r.asset_id,
            cost=_d(r.basis),
            placed_in_service=pis,
            recovery_years=_d(r.recovery_months) / 12,
            method=Method(r.method),
            convention=convention,
            section_179=_d(r.section_179),
            bonus_rate=_d(r.bonus_rate),
        )
        for row in depreciation_schedule(asset, rules=rules):
            out.append(
                {
                    "tenant_id": r.tenant_id,
                    "entity_id": r.entity_id,
                    "asset_id": r.asset_id,
                    "book_id": r.book_id,
                    "tax_year": row.tax_year,
                    "months": str(row.months),
                    "rate_pct": str(row.rate_pct),
                    "section_179": str(row.section_179),
                    "bonus": str(row.bonus),
                    "depreciation": str(row.depreciation),
                    "accumulated": str(row.accumulated),
                    "net_book_value": str(row.net_book_value),
                    "convention": convention.value,
                }
            )
    return pd.DataFrame(out, columns=[c.split()[0] for c in OUTPUT_SCHEMA.split(", ")])


def main(spark, catalog: str = "dev_tenant", run_id: str | None = None) -> None:  # pragma: no cover - needs Spark
    """Databricks job entry point: current book versions → gold.depr_schedule for one run."""
    import uuid

    from pyspark.sql import functions as F

    run_id = run_id or str(uuid.uuid4())
    current = (
        spark.table(f"{catalog}.silver.asset_book_version")
        .where(F.col("superseded_at").isNull())
        .join(
            spark.table(f"{catalog}.silver.asset_version").where(F.col("superseded_at").isNull()),
            ["tenant_id", "asset_id"],
        )
        .select(
            "tenant_id", "entity_id", "asset_id", "book_id", "placed_in_service_on", "method",
            "recovery_months", "convention", F.col("basis").cast("string").alias("basis"),
            F.col("section_179").cast("string").alias("section_179"),
            F.col("bonus_rate").cast("string").alias("bonus_rate"),
        )
    )
    result = (
        current.groupBy("tenant_id", "entity_id", "book_id")
        .applyInPandas(run_entity_year, schema=OUTPUT_SCHEMA)
        .withColumn("run_id", F.lit(run_id))
    )
    result.write.mode("append").saveAsTable(f"{catalog}.gold.depr_schedule_staging")
