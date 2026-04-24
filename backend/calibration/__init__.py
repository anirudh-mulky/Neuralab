"""
NeuroLab calibration layer.

Maps TRIBE's raw cortical predictions into market-aware, demographically
adjusted scores. At launch, all markets use Layer 3 (literature-adjusted).
Layer 1 (ground-truth via LAMBDA) and Layer 2 (Prolific panels) will be
added progressively.
"""
from .registry import (
    MARKETS,
    AGE_BRACKETS,
    MarketProfile,
    CalibrationResult,
    apply_market_calibration,
    describe_calibration,
)

__all__ = [
    "MARKETS",
    "AGE_BRACKETS",
    "MarketProfile",
    "CalibrationResult",
    "apply_market_calibration",
    "describe_calibration",
]