/**
 * NeuroLab calibration — frontend mirror of backend/calibration/registry.py
 *
 * Why this lives in the frontend: calibration is a display-time operation,
 * not an inference-time one. TRIBE runs once, produces raw four-region
 * scores. Those raw scores get re-weighted per the selected market + age
 * bracket on every render, instantly, without re-hitting the GPU.
 *
 * This means a user can run an analysis once and then slide through
 * different markets on the results page to see how the winner shifts.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * EPISTEMIC HONESTY NOTE
 * ═══════════════════════════════════════════════════════════════════════════
 * Directional adjustments are grounded in peer-reviewed cross-cultural and
 * aging neuroscience. Exact numbers are calibrated heuristics — NOT fitted
 * against per-market data. Every Layer 3 market shows a grey confidence dot
 * in the UI. See backend/calibration/registry.py for full citations.
 */

import type { MetricKey, Metrics } from "./types"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type CalibrationLayer = "ground_truth" | "behavioral" | "literature"
export type MarketId =
  | "global" | "us" | "uk" | "india" | "china" | "japan" | "brazil" | "germany"
export type AgeBracket = "18_34" | "35_54" | "55_plus" | "all_ages"
export type CalibratedMetricKey = "visual" | "attention" | "memory" | "reward"

export interface MarketProfile {
  id: MarketId
  displayName: string
  shortLabel: string          // for compact displays
  regionCluster: string
  layer: CalibrationLayer
  baseWeights: Record<CalibratedMetricKey, number>
  citationNote: string
  flagGlyph: string           // tiny visual token for the dropdown
}

export interface CalibrationResult {
  market: MarketId
  age: AgeBracket
  layer: CalibrationLayer
  weights: Record<CalibratedMetricKey, number>
  finalScore: number          // 0–100
  description: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Regional base weights — mirrored from backend/calibration/registry.py
// ─────────────────────────────────────────────────────────────────────────────

const CLUSTER_WEIGHTS: Record<string, Record<CalibratedMetricKey, number>> = {
  // Western default — what TRIBE was trained on
  global_default: { visual: 0.25, attention: 0.25, memory: 0.25, reward: 0.25 },

  // East Asia — scene/contextual emphasis (Nisbett, Masuda, Gutchess et al.)
  east_asia:      { visual: 0.22, attention: 0.23, memory: 0.30, reward: 0.25 },

  // South Asia — conservative adjustment, memory slightly up
  south_asia:     { visual: 0.24, attention: 0.24, memory: 0.27, reward: 0.25 },

  // Latin America — reward-circuit emphasis
  latin_america:  { visual: 0.24, attention: 0.22, memory: 0.23, reward: 0.31 },

  // Northern Europe — slightly lower reward, more analytic
  northern_europe:{ visual: 0.26, attention: 0.26, memory: 0.26, reward: 0.22 },

  // Anglosphere — matches TRIBE training distribution
  anglosphere:    { visual: 0.25, attention: 0.25, memory: 0.25, reward: 0.25 },
}

// Age bracket overlays — modest shifts, applied on top of regional weights
const AGE_OVERLAYS: Record<AgeBracket, Record<CalibratedMetricKey, number>> = {
  "18_34":    { visual:  0.00, attention:  0.00, memory:  0.00, reward:  0.00 },
  "35_54":    { visual: -0.01, attention: +0.01, memory: +0.02, reward: -0.02 },
  "55_plus":  { visual: -0.02, attention: -0.01, memory: +0.01, reward: +0.02 },
  "all_ages": { visual:  0.00, attention:  0.00, memory:  0.00, reward:  0.00 },
}

// ─────────────────────────────────────────────────────────────────────────────
// The eight market profiles
// ─────────────────────────────────────────────────────────────────────────────

export const MARKETS: Record<MarketId, MarketProfile> = {
  global: {
    id: "global",
    displayName: "Global default",
    shortLabel: "Global",
    regionCluster: "global_default",
    layer: "literature",
    baseWeights: CLUSTER_WEIGHTS.global_default,
    citationNote: "TRIBE's native training distribution. No regional adjustment applied.",
    flagGlyph: "◯",
  },
  us: {
    id: "us",
    displayName: "United States",
    shortLabel: "US",
    regionCluster: "anglosphere",
    layer: "literature",
    baseWeights: CLUSTER_WEIGHTS.anglosphere,
    citationNote: "Matches TRIBE's training distribution. No cluster adjustment needed.",
    flagGlyph: "US",
  },
  uk: {
    id: "uk",
    displayName: "United Kingdom",
    shortLabel: "UK",
    regionCluster: "anglosphere",
    layer: "literature",
    baseWeights: CLUSTER_WEIGHTS.anglosphere,
    citationNote: "Matches TRIBE's training distribution. No cluster adjustment needed.",
    flagGlyph: "UK",
  },
  india: {
    id: "india",
    displayName: "India",
    shortLabel: "IN",
    regionCluster: "south_asia",
    layer: "literature",
    baseWeights: CLUSTER_WEIGHTS.south_asia,
    citationNote: "Literature-adjusted. Roadmap: ground-truth calibration via LAMBDA dataset (2,205 ads, 1,749 Indian participants).",
    flagGlyph: "IN",
  },
  china: {
    id: "china",
    displayName: "China",
    shortLabel: "CN",
    regionCluster: "east_asia",
    layer: "literature",
    baseWeights: CLUSTER_WEIGHTS.east_asia,
    citationNote: "East Asian cluster — scene/contextual processing emphasis per Nisbett et al.",
    flagGlyph: "CN",
  },
  japan: {
    id: "japan",
    displayName: "Japan",
    shortLabel: "JP",
    regionCluster: "east_asia",
    layer: "literature",
    baseWeights: CLUSTER_WEIGHTS.east_asia,
    citationNote: "East Asian cluster — scene/contextual processing emphasis per Nisbett et al.",
    flagGlyph: "JP",
  },
  brazil: {
    id: "brazil",
    displayName: "Brazil",
    shortLabel: "BR",
    regionCluster: "latin_america",
    layer: "literature",
    baseWeights: CLUSTER_WEIGHTS.latin_america,
    citationNote: "Latin America cluster — modest reward-circuit emphasis per consumer neuroscience work.",
    flagGlyph: "BR",
  },
  germany: {
    id: "germany",
    displayName: "Germany",
    shortLabel: "DE",
    regionCluster: "northern_europe",
    layer: "literature",
    baseWeights: CLUSTER_WEIGHTS.northern_europe,
    citationNote: "Northern European cluster — slightly lower reward weighting per analytic-response literature.",
    flagGlyph: "DE",
  },
}

export const MARKET_ORDER: MarketId[] = [
  "global", "us", "uk", "india", "china", "japan", "brazil", "germany",
]

export const AGE_BRACKETS: Record<AgeBracket, { short: string; long: string }> = {
  "18_34":    { short: "18 – 34",   long: "18 to 34 years" },
  "35_54":    { short: "35 – 54",   long: "35 to 54 years" },
  "55_plus":  { short: "55+",       long: "55 and over"    },
  "all_ages": { short: "All ages",  long: "All age groups" },
}

export const AGE_ORDER: AgeBracket[] = ["18_34", "35_54", "55_plus", "all_ages"]

// ─────────────────────────────────────────────────────────────────────────────
// Calibration logic
// ─────────────────────────────────────────────────────────────────────────────

function renormalize(w: Record<CalibratedMetricKey, number>): Record<CalibratedMetricKey, number> {
  const total = w.visual + w.attention + w.memory + w.reward
  if (total <= 0) return { visual: 0.25, attention: 0.25, memory: 0.25, reward: 0.25 }
  return {
    visual:    w.visual / total,
    attention: w.attention / total,
    memory:    w.memory / total,
    reward:    w.reward / total,
  }
}

function combineWeights(
  base: Record<CalibratedMetricKey, number>,
  overlay: Record<CalibratedMetricKey, number>,
): Record<CalibratedMetricKey, number> {
  return renormalize({
    visual:    Math.max(0, base.visual    + overlay.visual),
    attention: Math.max(0, base.attention + overlay.attention),
    memory:    Math.max(0, base.memory    + overlay.memory),
    reward:    Math.max(0, base.reward    + overlay.reward),
  })
}

/**
 * Turn raw TRIBE scores into a market-and-age-calibrated single number.
 * Pure function. Called on every render — cheap.
 */
export function calibrate(
  metrics: Metrics,
  market: MarketId = "global",
  age: AgeBracket = "18_34",
): CalibrationResult {
  const profile = MARKETS[market] ?? MARKETS.global
  const overlay = AGE_OVERLAYS[age]  ?? AGE_OVERLAYS["18_34"]

  const weights = combineWeights(profile.baseWeights, overlay)

  const raw = {
    visual:    metrics.visual    ?? 0,
    attention: metrics.attention ?? 0,
    memory:    metrics.memory    ?? 0,
    reward:    metrics.reward    ?? 0,
  }

  const weighted =
    raw.visual    * weights.visual +
    raw.attention * weights.attention +
    raw.memory    * weights.memory +
    raw.reward    * weights.reward

  return {
    market,
    age,
    layer: profile.layer,
    weights,
    finalScore: Math.max(0, Math.min(100, Math.round(weighted))),
    description: describeCalibration(market, age),
  }
}

export function describeCalibration(market: MarketId, age: AgeBracket): string {
  const profile = MARKETS[market] ?? MARKETS.global
  const ageLabel = AGE_BRACKETS[age]?.long ?? AGE_BRACKETS["18_34"].long
  const layerLabel = {
    ground_truth: "ground-truth calibrated",
    behavioral:   "behaviorally calibrated",
    literature:   "literature-adjusted",
  }[profile.layer]
  return `${profile.displayName} · ${ageLabel} · ${layerLabel}`
}

// ─────────────────────────────────────────────────────────────────────────────
// Confidence indicator — a single source of truth for the visual badge
// ─────────────────────────────────────────────────────────────────────────────

export interface ConfidenceIndicator {
  layer: CalibrationLayer
  label: string
  shortLabel: string
  tint: "green" | "yellow" | "grey"
  dotColor: string          // Tailwind class
  textColor: string
}

export function confidenceFor(layer: CalibrationLayer): ConfidenceIndicator {
  switch (layer) {
    case "ground_truth":
      return {
        layer,
        label: "Ground-truth calibrated",
        shortLabel: "Validated",
        tint: "green",
        dotColor: "bg-teal-500",
        textColor: "text-teal-700",
      }
    case "behavioral":
      return {
        layer,
        label: "Behaviorally calibrated",
        shortLabel: "Panel-based",
        tint: "yellow",
        dotColor: "bg-amber-500",
        textColor: "text-amber-800",
      }
    case "literature":
    default:
      return {
        layer: "literature",
        label: "Literature-adjusted",
        shortLabel: "Default",
        tint: "grey",
        dotColor: "bg-txt-tertiary",
        textColor: "text-txt-secondary",
      }
  }
}

/**
 * Helper to determine winner given calibrated scores for both ads.
 * Mirrors the pickWinner logic in ResultsDashboard but returns the
 * calibrated single-number comparison instead of the 4-metric average.
 */
export function pickCalibratedWinner(
  metricsA: Metrics,
  metricsB: Metrics,
  market: MarketId,
  age: AgeBracket,
) {
  const resA = calibrate(metricsA, market, age)
  const resB = calibrate(metricsB, market, age)
  const lead = Math.abs(resA.finalScore - resB.finalScore)
  const winner = resA.finalScore >= resB.finalScore ? "A" : "B"

  const confidence: "tied" | "low" | "medium" | "high" =
    lead < 3 ? "tied" : lead < 8 ? "low" : lead < 18 ? "medium" : "high"

  return {
    winner: winner as "A" | "B",
    lead,
    confidence,
    scoreA: resA.finalScore,
    scoreB: resB.finalScore,
    calibration: resA,   // both share the same calibration profile
  }
}

/** Exposed so frontend can record history without recomputing. */
export function overallScore(metrics: Metrics): number {
  // Backward-compat: unweighted average of the 4 core metrics.
  // Used for history entries where market isn't stored.
  return Math.round(
    ((metrics.visual ?? 0) +
     (metrics.attention ?? 0) +
     (metrics.memory ?? 0) +
     (metrics.reward ?? 0)) / 4,
  )
}

export type { MetricKey }