"""fa_engine: fixed-asset depreciation and disposition engine (prototype)."""

from .conventions import Convention, Method, mid_quarter_applies
from .depreciation import Asset, ScheduleRow, depreciation_schedule, total_depreciation
from .disposition import (
    DispositionKind,
    DispositionResult,
    EntityType,
    PropertyType,
    compute_disposition,
)
from .rules import FederalRules
from .section179 import Section179Computation, compute_section179

__all__ = [
    "Asset",
    "Convention",
    "DispositionKind",
    "DispositionResult",
    "EntityType",
    "FederalRules",
    "Method",
    "PropertyType",
    "ScheduleRow",
    "Section179Computation",
    "compute_disposition",
    "compute_section179",
    "depreciation_schedule",
    "mid_quarter_applies",
    "total_depreciation",
]
