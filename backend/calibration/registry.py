"""
Market + age calibration registry.

THREE LAYERS of calibration quality, per market:
  Layer 1 — Ground-truth calibrated (fitted regression against a real
            viewer-response dataset, e.g. LAMBDA for India).
  Layer 2 — Behaviorally calibrated (fitted against a commissioned Prolific
            panel of ~500 viewers in that market).
  Layer 3 — Literature-adjusted (published cross-cultural neuroscience
            informs directional weight shifts; exact numbers are first-pass
            heuristics, NOT fitted against data).

At launch: ALL eight markets are Layer 3.
India will move to Layer 1 when the LAMBDA calibration sprint completes.
Other markets will move to Layer 2 as commercial demand warrants panels.

─────────────────────────────────────────────────────────────────────────────
HONEST EPISTEMIC STATUS OF THESE WEIGHTS
─────────────────────────────────────────────────────────────────────────────
The DIRECTIONS of the adjustments (East Asian → memory/context emphasis,
older viewers → reward, etc.) are grounded in peer-reviewed cross-cultural
and aging neuroscience. Specific citations are in the comments per cluster.

The EXACT NUMBERS (e.g. memory=0.30 for East Asia rather than 0.28 or 0.32)
are calibrated heuristics, NOT derived from any single validated study.
They honor the direction of the published effects.

This is why every Layer-3 market carries a grey confidence indicator in the
UI. Users see a literature-based adjustment, transparently flagged.
"""
from dataclasses import dataclass
from typing import Literal

# ─────────────────────────────────────────────────────────────────────────────
# Types
# ─────────────────────────────────────────────────────────────────────────────

CalibrationLayer = Literal["ground_truth", "behavioral", "literature"]
MarketId   = str   # "global" | "india" | "us" | ...
AgeBracket = Literal["18_34", "35_54", "55_plus", "all_ages"]
MetricKey  = Literal["visual", "attention", "memory", "reward"]


@dataclass(frozen=True)
class MarketProfile:
    id: MarketId
    display_name: str
    region_cluster: str         # for grouping in the UI
    layer: CalibrationLayer
    # Literature-based base weights (should sum to ~1.0). These are used when
    # layer == "literature". For "behavioral" / "ground_truth" markets, we
    # substitute with fitted regressors (not implemented yet — noted in code).
    base_weights: dict[MetricKey, float]
    citation_note: str          # one-line epistemic caveat shown in the UI


@dataclass(frozen=True)
class CalibrationResult:
    market: MarketId
    age: AgeBracket
    layer: CalibrationLayer
    weights: dict[MetricKey, float]      # the final renormalized weights used
    final_score: int                     # 0–100, the aggregate
    raw_scores: dict[MetricKey, float]   # what TRIBE actually produced
    description: str                     # human-readable "South Asia · 35-54 · literature-based"


# ─────────────────────────────────────────────────────────────────────────────
# Regional base weights — the heart of Layer 3
#
# Each cluster has one base weight vector. Markets within a cluster share it
# (e.g. Japan and China both get "east_asia" weights). A market can later
# diverge from its cluster by moving to Layer 1/2 with fitted weights.
# ─────────────────────────────────────────────────────────────────────────────

_CLUSTER_WEIGHTS: dict[str, dict[MetricKey, float]] = {

    # ─────────────────── GLOBAL / WESTERN DEFAULT ──────────────────────────
    # This is effectively "what TRIBE's training subjects' brains do."
    # 25 subjects, mostly Western/English-speaking academic recruitment.
    # Equal weights — no adjustment, used as the reference point.
    "global_default": {
        "visual": 0.25, "attention": 0.25, "memory": 0.25, "reward": 0.25,
    },

    # ─────────────────── EAST ASIA (JP, CN, KR) ────────────────────────────
    # Basis: Nisbett & Masuda (2003), Gutchess et al. (2006), Jenkins et al.
    # (2010). East Asian viewers show relatively stronger engagement of
    # scene/contextual-processing regions (parahippocampal, precuneus) and
    # less object-centric processing than Western subjects for equivalent
    # stimuli. Effect size is modest (~10–15% relative shift in activation).
    # Our adjustment nudges memory (context/scene) up, visual (object-focus)
    # slightly down. Reward/attention stay roughly baseline.
    "east_asia": {
        "visual": 0.22, "attention": 0.23, "memory": 0.30, "reward": 0.25,
    },

    # ─────────────────── SOUTH ASIA (IN, BD, PK) ───────────────────────────
    # Basis: Limited direct fMRI literature on South Asian consumer neural
    # response. We apply a conservative adjustment leaning slightly toward
    # contextual memory (some evidence from self-report studies of richer
    # narrative engagement in Indian advertising) while staying close to the
    # default baseline. This is the market most urgent to upgrade to Layer 1
    # via the LAMBDA dataset (2,205 ads, 1,749 Indian participants).
    "south_asia": {
        "visual": 0.24, "attention": 0.24, "memory": 0.27, "reward": 0.25,
    },

    # ─────────────────── LATIN AMERICA (BR, MX, AR) ────────────────────────
    # Basis: Some cross-cultural consumer neuroscience work (Nunez et al.,
    # various) suggests relatively stronger emotional/reward-circuit
    # engagement with advertising in Latin American populations. Again
    # modest; exact numbers heuristic.
    "latin_america": {
        "visual": 0.24, "attention": 0.22, "memory": 0.23, "reward": 0.31,
    },

    # ─────────────────── NORTHERN EUROPE (DE, NL, NORDICS) ─────────────────
    # Basis: Published work on Nordic/German populations suggests more
    # conservative / analytic-focused response patterns — relatively weaker
    # reward-circuit activation to overt emotional appeal, stronger
    # deliberative/attention processing. Adjustment is small.
    "northern_europe": {
        "visual": 0.26, "attention": 0.26, "memory": 0.26, "reward": 0.22,
    },

    # ─────────────────── ANGLOSPHERE (US, UK, AU, CA) ──────────────────────
    # Matches global_default — this is effectively the population TRIBE was
    # trained on. Broken out so the UI can show "US" / "UK" as named markets
    # rather than hiding them under "Global".
    "anglosphere": {
        "visual": 0.25, "attention": 0.25, "memory": 0.25, "reward": 0.25,
    },
}


# ─────────────────────────────────────────────────────────────────────────────
# Age overlay — multiplicative adjustments applied on top of regional weights
#
# Basis:
#  18–34: baseline (matches TRIBE training cohort — young adults).
#  35–54: modest memory consolidation emphasis (Craik & Salthouse work on
#         mid-life cognitive profiles — stronger encoding of meaningful info).
#  55+  : positivity effect (Carstensen, Mather, et al., widely replicated).
#         Older adults show relatively stronger amygdala/vmPFC response to
#         positive content and weaker attentional capture. We boost reward
#         and shift away from raw bottom-up visual capture.
#  all_ages: no overlay.
# ─────────────────────────────────────────────────────────────────────────────

_AGE_OVERLAYS: dict[AgeBracket, dict[MetricKey, float]] = {
    "18_34":    {"visual": 0.00, "attention": 0.00, "memory": 0.00, "reward": 0.00},
    "35_54":    {"visual": -0.01, "attention": +0.01, "memory": +0.02, "reward": -0.02},
    "55_plus":  {"visual": -0.02, "attention": -0.01, "memory": +0.01, "reward": +0.02},
    "all_ages": {"visual": 0.00, "attention": 0.00, "memory": 0.00, "reward": 0.00},
}


# ─────────────────────────────────────────────────────────────────────────────
# The eight markets exposed in the UI
# ─────────────────────────────────────────────────────────────────────────────

MARKETS: dict[MarketId, MarketProfile] = {
    "global": MarketProfile(
        id="global",
        display_name="Global default",
        region_cluster="global_default",
        layer="literature",
        base_weights=_CLUSTER_WEIGHTS["global_default"],
        citation_note="TRIBE's native training distribution. No regional adjustment.",
    ),
    "us": MarketProfile(
        id="us",
        display_name="United States",
        region_cluster="anglosphere",
        layer="literature",
        base_weights=_CLUSTER_WEIGHTS["anglosphere"],
        citation_note="Matches TRIBE training distribution. No cluster adjustment needed.",
    ),
    "uk": MarketProfile(
        id="uk",
        display_name="United Kingdom",
        region_cluster="anglosphere",
        layer="literature",
        base_weights=_CLUSTER_WEIGHTS["anglosphere"],
        citation_note="Matches TRIBE training distribution. No cluster adjustment needed.",
    ),
    "india": MarketProfile(
        id="india",
        display_name="India",
        region_cluster="south_asia",
        layer="literature",
        base_weights=_CLUSTER_WEIGHTS["south_asia"],
        citation_note=(
            "Literature-adjusted. Roadmap: upgrade to ground-truth via the LAMBDA "
            "dataset (2,205 ads, 1,749 Indian participants; Harini SI et al. 2024)."
        ),
    ),
    "china": MarketProfile(
        id="china",
        display_name="China",
        region_cluster="east_asia",
        layer="literature",
        base_weights=_CLUSTER_WEIGHTS["east_asia"],
        citation_note="East Asian cluster — scene/contextual processing emphasis per Nisbett et al.",
    ),
    "japan": MarketProfile(
        id="japan",
        display_name="Japan",
        region_cluster="east_asia",
        layer="literature",
        base_weights=_CLUSTER_WEIGHTS["east_asia"],
        citation_note="East Asian cluster — scene/contextual processing emphasis per Nisbett et al.",
    ),
    "brazil": MarketProfile(
        id="brazil",
        display_name="Brazil",
        region_cluster="latin_america",
        layer="literature",
        base_weights=_CLUSTER_WEIGHTS["latin_america"],
        citation_note="Latin America cluster — modest reward-circuit emphasis per consumer neuroscience work.",
    ),
    "germany": MarketProfile(
        id="germany",
        display_name="Germany",
        region_cluster="northern_europe",
        layer="literature",
        base_weights=_CLUSTER_WEIGHTS["northern_europe"],
        citation_note="Northern European cluster — slightly lower reward weighting per analytic-response literature.",
    ),
}

AGE_BRACKETS: dict[AgeBracket, str] = {
    "18_34":    "18 to 34",
    "35_54":    "35 to 54",
    "55_plus":  "55 and over",
    "all_ages": "All ages",
}


# ─────────────────────────────────────────────────────────────────────────────
# The main calibration function
# ─────────────────────────────────────────────────────────────────────────────

def _renormalize(w: dict[MetricKey, float]) -> dict[MetricKey, float]:
    total = sum(w.values())
    if total <= 0:
        return {k: 0.25 for k in w}
    return {k: v / total for k, v in w.items()}


def _combine_weights(
    base: dict[MetricKey, float],
    overlay: dict[MetricKey, float],
) -> dict[MetricKey, float]:
    """Add overlay to base, floor at 0, renormalize to sum to 1.0."""
    combined = {k: max(0.0, base[k] + overlay[k]) for k in base}
    return _renormalize(combined)


def apply_market_calibration(
    raw_scores: dict[MetricKey, float],
    market: MarketId = "global",
    age: AgeBracket = "18_34",
) -> CalibrationResult:
    """
    Translate TRIBE's raw four-region scores into a market-adjusted single score.

    raw_scores : dict mapping each of visual/attention/memory/reward to 0–100.
    market     : which of MARKETS to apply.
    age        : which of AGE_BRACKETS to overlay.

    Returns a CalibrationResult bundling everything the UI needs.
    """
    profile = MARKETS.get(market) or MARKETS["global"]
    overlay = _AGE_OVERLAYS.get(age) or _AGE_OVERLAYS["18_34"]

    weights = _combine_weights(profile.base_weights, overlay)

    # Weighted sum → 0–100 integer
    weighted = sum(raw_scores[k] * weights[k] for k in weights)
    final_score = int(round(max(0, min(100, weighted))))

    description = describe_calibration(market, age)

    return CalibrationResult(
        market=market,
        age=age,
        layer=profile.layer,
        weights=weights,
        final_score=final_score,
        raw_scores=dict(raw_scores),
        description=description,
    )


def describe_calibration(market: MarketId, age: AgeBracket) -> str:
    """Human-readable string for the UI badge."""
    profile = MARKETS.get(market) or MARKETS["global"]
    layer_label = {
        "ground_truth": "ground-truth calibrated",
        "behavioral":   "behaviorally calibrated",
        "literature":   "literature-adjusted",
    }[profile.layer]
    age_label = AGE_BRACKETS.get(age, AGE_BRACKETS["18_34"])
    return f"{profile.display_name} · {age_label} · {layer_label}"