import { useMemo, useState } from "react"
import type { AdResult, MetricKey, Metrics } from "../lib/types"
import {
  calibrate, confidenceFor, describeCalibration, MARKETS,
} from "../lib/calibration"
import type { AgeBracket, MarketId } from "../lib/calibration"
import { BrainMap } from "./BrainMap"
import { MetricCard } from "./MetricCard"

type Props = {
  resultA: AdResult
  resultB: AdResult
  market: MarketId
  age: AgeBracket
}

type Confidence = "tied" | "low" | "medium" | "high"

type DisplayMetric = { key: MetricKey; name: string; desc: string }

const DISPLAY_METRICS: DisplayMetric[] = [
  { key: "visual",    name: "Eye-catching",    desc: "how much the eye locks on" },
  { key: "attention", name: "Holds attention", desc: "how long focus stays engaged" },
  { key: "memory",    name: "Memorable",       desc: "how likely it is to stick" },
  { key: "reward",    name: "Emotional pull",  desc: "the feel-good response" },
]

const METRIC_VERBS: Record<MetricKey, string> = {
  visual:    "catches the eye harder",
  attention: "holds attention longer",
  memory:    "lands more firmly in memory",
  reward:    "lights up the reward circuit",
  auditory:  "",
  language:  "",
}

const METRIC_NOUNS: Record<MetricKey, string> = {
  visual:    "visual lock",
  attention: "attention",
  memory:    "memorability",
  reward:    "emotional pull",
  auditory:  "",
  language:  "",
}

function classifyLead(lead: number): Confidence {
  if (lead < 3)  return "tied"
  if (lead < 8)  return "low"
  if (lead < 18) return "medium"
  return "high"
}

function analyzeResults(
  a: Metrics, b: Metrics, market: MarketId, age: AgeBracket,
) {
  const calA = calibrate(a, market, age)
  const calB = calibrate(b, market, age)
  const scoreA = calA.finalScore
  const scoreB = calB.finalScore
  const lead = Math.abs(scoreA - scoreB)
  const winner: "A" | "B" = scoreA >= scoreB ? "A" : "B"
  const confidence = classifyLead(lead)

  const keys: MetricKey[] = ["visual", "attention", "memory", "reward"]
  const diffs = keys
    .map((k) => {
      const delta = winner === "A" ? (a[k] ?? 0) - (b[k] ?? 0) : (b[k] ?? 0) - (a[k] ?? 0)
      return { key: k, delta: Math.round(delta) }
    })
    .filter((d) => d.delta > 0)
    .sort((x, y) => y.delta - x.delta)

  return {
    winner, lead, confidence,
    scoreA, scoreB,
    topDiffs: diffs.slice(0, 2),
    calibration: calA,
  }
}

// ═══════════════════════════════════════════════════════════════════════════
//   Main component
// ═══════════════════════════════════════════════════════════════════════════

export function ResultsDashboard({ resultA, resultB, market, age }: Props) {
  const [brainsOpen, setBrainsOpen] = useState(false)
  const [diagOpen,   setDiagOpen]   = useState(true)
  const [calibOpen,  setCalibOpen]  = useState(false)

  const mA = resultA.metrics
  const mB = resultB.metrics

  const analysis = useMemo(
    () => analyzeResults(mA, mB, market, age),
    [mA, mB, market, age],
  )

  const { winner, lead, confidence, scoreA, scoreB, topDiffs, calibration } = analysis
  const winnerLabel = winner === "A" ? resultA.filename : resultB.filename
  const loserLabel  = winner === "A" ? resultB.filename : resultA.filename
  const winnerScore = winner === "A" ? scoreA : scoreB
  const loserScore  = winner === "A" ? scoreB : scoreA
  const conf = confidenceFor(calibration.layer)
  const profile = MARKETS[market]

  return (
    <div className="space-y-7">
      {/* ═══════════════════════════════════════════════════════════
          WINNER MOMENT — editorial centerpiece, bigger & richer
          ═══════════════════════════════════════════════════════════ */}
      <section>
        <WinnerMoment
          winner={winner}
          confidence={confidence}
          lead={lead}
          winnerLabel={winnerLabel}
          winnerScore={winnerScore}
          loserScore={loserScore}
          marketDescription={describeCalibration(market, age)}
          calibrationDotColor={conf.dotColor}
          calibrationTextColor={conf.textColor}
          calibrationShortLabel={conf.shortLabel}
        />
      </section>

      {/* ═══════════════════════════════════════════════════════════
          DIAGNOSIS
          ═══════════════════════════════════════════════════════════ */}
      {confidence !== "tied" && topDiffs.length > 0 && (
        <details
          open={diagOpen}
          onToggle={(e) => setDiagOpen((e.target as HTMLDetailsElement).open)}
          className="group bg-bg-card border border-border rounded-2xl overflow-hidden gradient-diagnosis"
        >
          <summary className="px-6 py-5 cursor-pointer list-none flex items-center justify-between hover:bg-bg-muted/30">
            <div>
              <div className="text-[11px] text-txt-tertiary mono tracking-[0.14em] uppercase">
                Diagnosis
              </div>
              <div className="text-[19px] font-medium text-txt-primary display mt-1">
                Why Ad {winner} won
              </div>
            </div>
            <div className={`text-txt-tertiary text-base transition-transform ${diagOpen ? "rotate-180" : ""}`}>▾</div>
          </summary>
          <div className="px-6 pb-6 pt-1">
            <div className="space-y-2.5">
              {topDiffs.map((d, i) => (
                <DiagnosisRow
                  key={d.key}
                  rank={i + 1}
                  noun={METRIC_NOUNS[d.key]}
                  verb={METRIC_VERBS[d.key]}
                  delta={d.delta}
                  winner={winner}
                />
              ))}
            </div>
            <div className="text-[13px] text-txt-secondary pt-4 mt-4 border-t border-border-dim leading-relaxed">
              <span className="text-txt-tertiary italic">In plain English: </span>
              <span>
                Ad {winner} ({truncate(winnerLabel, 34)}) outperforms Ad {winner === "A" ? "B" : "A"} ({truncate(loserLabel, 34)}){" "}
                {topDiffs.length === 1
                  ? `because it ${METRIC_VERBS[topDiffs[0].key]}.`
                  : `because it ${METRIC_VERBS[topDiffs[0].key]}, and ${METRIC_VERBS[topDiffs[1].key]}.`}
              </span>
            </div>
          </div>
        </details>
      )}

      {/* ═══════════════════════════════════════════════════════════
          METRIC BARS
          ═══════════════════════════════════════════════════════════ */}
      <section>
        <div className="flex items-end justify-between mb-4">
          <div>
            <div className="text-[11px] text-txt-tertiary mono tracking-[0.14em] uppercase">
              Signal breakdown
            </div>
            <h2 className="text-[19px] font-medium text-txt-primary display mt-1">
              How each ad performed
            </h2>
          </div>
          <span className="text-[12px] text-txt-tertiary mono">
            4 of 6 signals · 2 unavailable
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {DISPLAY_METRICS.map((d) => (
            <MetricCard
              key={d.key}
              name={d.name}
              desc={d.desc}
              valA={Math.round(mA[d.key] ?? 0)}
              valB={Math.round(mB[d.key] ?? 0)}
            />
          ))}
        </div>

        <div className="bg-bg-muted rounded-lg px-4 py-3 flex items-start gap-3 mt-4">
          <div className="w-5 h-5 rounded-full bg-border text-txt-secondary flex items-center justify-center flex-shrink-0 text-[11px] font-semibold font-display mt-0.5">
            i
          </div>
          <div className="text-[12px] text-txt-secondary leading-relaxed">
            <span className="text-txt-primary font-medium">
              Sound &amp; message response not measured.
            </span>{" "}
            Audio is removed before analysis — on the roadmap to re-enable for video mode.
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════
          CALIBRATION TRANSPARENCY — with lavender wash
          ═══════════════════════════════════════════════════════════ */}
      <details
        open={calibOpen}
        onToggle={(e) => setCalibOpen((e.target as HTMLDetailsElement).open)}
        className="border border-border rounded-2xl overflow-hidden gradient-calibration"
      >
        <summary className="px-6 py-5 cursor-pointer list-none flex items-center justify-between hover:bg-purple-25">
          <div>
            <div className="text-[11px] text-txt-tertiary mono tracking-[0.14em] uppercase">
              How this score was calibrated
            </div>
            <div className="text-[15px] font-medium text-txt-primary mt-1 flex items-center gap-2 flex-wrap">
              <span className={`w-1.5 h-1.5 rounded-full ${conf.dotColor}`} />
              <span>{profile.displayName}</span>
              <span className="text-txt-tertiary">·</span>
              <span className="text-txt-secondary font-normal">{conf.label}</span>
            </div>
          </div>
          <div className={`text-txt-tertiary text-base transition-transform ${calibOpen ? "rotate-180" : ""}`}>▾</div>
        </summary>
        <div className="px-6 pb-6 pt-1 space-y-4">
          <div className="text-[13px] text-txt-secondary leading-relaxed">
            {profile.citationNote}
          </div>

          <div>
            <div className="text-[11px] text-txt-tertiary mono tracking-[0.1em] uppercase mb-2.5">
              Signal weights applied
            </div>
            <div className="space-y-2">
              {(["visual", "attention", "memory", "reward"] as const).map((k) => (
                <WeightBar
                  key={k}
                  label={METRIC_NOUNS[k]}
                  weight={calibration.weights[k]}
                />
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-border-dim text-[12px] text-txt-tertiary leading-relaxed">
            Equal weighting across four signals is the default ({`0.25 × 4 = 1.0`}).
            Regional and age adjustments shift the weights by small amounts based on
            published cross-cultural and aging neuroscience literature.
          </div>
        </div>
      </details>

      {/* ═══════════════════════════════════════════════════════════
          BRAIN MAPS
          ═══════════════════════════════════════════════════════════ */}
      <details
        open={brainsOpen}
        onToggle={(e) => setBrainsOpen((e.target as HTMLDetailsElement).open)}
        className="bg-bg-card border border-border rounded-2xl overflow-hidden"
      >
        <summary className="px-6 py-5 cursor-pointer list-none flex items-center justify-between hover:bg-bg-muted/40">
          <div>
            <div className="text-[11px] text-txt-tertiary mono tracking-[0.14em] uppercase">
              Neural detail
            </div>
            <div className="text-[19px] font-medium text-txt-primary display mt-1">
              Brain response maps
            </div>
          </div>
          <div className={`text-txt-tertiary text-base transition-transform ${brainsOpen ? "rotate-180" : ""}`}>▾</div>
        </summary>
        <div className="px-6 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-1.5">
            <div>
              <div className="text-[11px] text-txt-tertiary tracking-[0.1em] mb-2 mono truncate">
                AD A · {resultA.filename}
              </div>
              <BrainMap metrics={mA} label="Ad A" />
            </div>
            <div>
              <div className="text-[11px] text-txt-tertiary tracking-[0.1em] mb-2 mono truncate">
                AD B · {resultB.filename}
              </div>
              <BrainMap metrics={mB} label="Ad B" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-border-dim text-[11px] text-txt-tertiary leading-relaxed">
            Darker circle = stronger predicted brain response. Numbers are 0–100
            intensity scores. The pulsing ring marks each ad's peak region. Powered by
            Meta FAIR's TRIBE v2, trained on fMRI from 25 subjects watching naturalistic
            video across 451.6 hours, evaluated on 720 subjects.
          </div>
        </div>
      </details>

      {/* Perf footer */}
      <div className="text-[11px] text-txt-tertiary mono flex items-center gap-4 pt-2 border-t border-border-dim">
        <span>A · {resultA.timing.inference_sec}s · {resultA.timing.peak_vram_gb}GB VRAM</span>
        <span className="text-border">|</span>
        <span>B · {resultB.timing.inference_sec}s · {resultB.timing.peak_vram_gb}GB VRAM</span>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//   WinnerMoment — visibly bigger display type, richer gradient per state
// ═══════════════════════════════════════════════════════════════════════════

function WinnerMoment({
  winner, confidence, lead,
  winnerLabel, winnerScore, loserScore,
  marketDescription,
  calibrationDotColor, calibrationTextColor, calibrationShortLabel,
}: {
  winner: "A" | "B"
  confidence: Confidence
  lead: number
  winnerLabel: string
  winnerScore: number
  loserScore: number
  marketDescription: string
  calibrationDotColor: string
  calibrationTextColor: string
  calibrationShortLabel: string
}) {
  const isTied = confidence === "tied"

  // Each confidence state gets its own gradient class + palette
  const gradientClass = {
    high:   "gradient-winner-high",
    medium: "gradient-winner-medium",
    low:    "gradient-winner-low",
    tied:   "gradient-winner-tied",
  }[confidence]

  const { eyebrow, barColor, labelColor, badgeBg } = confidence === "high"
    ? { eyebrow: "Winner",             barColor: "bg-teal-500",    labelColor: "text-teal-700",  badgeBg: "bg-teal-500" }
    : confidence === "medium"
    ? { eyebrow: "Winner",             barColor: "bg-teal-500",    labelColor: "text-teal-700",  badgeBg: "bg-teal-500" }
    : confidence === "low"
    ? { eyebrow: "Edges out",          barColor: "bg-amber-500",   labelColor: "text-amber-900", badgeBg: "bg-amber-500" }
    : { eyebrow: "Too close to call",  barColor: "bg-txt-tertiary", labelColor: "text-txt-secondary", badgeBg: "bg-txt-tertiary" }

  return (
    <div className={`relative rounded-2xl ${gradientClass} overflow-hidden border border-border-dim`}>
      <div className="relative px-7 py-9 md:px-10 md:py-11">
        {/* Header row — eyebrow + calibration badge */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-2.5">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[14px] font-bold leading-none ${badgeBg}`}>
              {isTied ? "=" : "✓"}
            </div>
            <div className={`text-[12px] font-semibold tracking-[0.16em] mono uppercase ${labelColor}`}>
              {eyebrow}
            </div>
          </div>

          <div
            className={`flex items-center gap-2 text-[11px] mono tracking-[0.1em] uppercase ${calibrationTextColor}`}
            title={marketDescription}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${calibrationDotColor}`} />
            <span>{calibrationShortLabel}</span>
          </div>
        </div>

        {/* Editorial headline — dramatically bigger */}
        <div className="mb-7">
          {isTied ? (
            <h2 className={`display display-tight font-medium text-[36px] md:text-[48px] lg:text-[54px] leading-[1.02] ${labelColor}`}>
              Ad&nbsp;A and Ad&nbsp;B are{" "}
              <span className="italic">statistically tied</span>.
            </h2>
          ) : (
            <h2 className={`display display-tight font-medium text-[40px] md:text-[54px] lg:text-[62px] leading-[1.0] ${labelColor}`}>
              Ad&nbsp;{winner} is the{" "}
              <span className="italic">
                {confidence === "high"   ? "clear" :
                 confidence === "medium" ? "likely" : "narrow"}
              </span>{" "}
              winner.
            </h2>
          )}
          <div className={`text-[13px] mono mt-3 truncate ${labelColor} opacity-75`}>
            {winnerLabel}
          </div>
        </div>

        {/* Score bars */}
        <div className="space-y-2.5 mb-5">
          <ScoreBar
            label="Ad A"
            score={winner === "A" ? winnerScore : loserScore}
            isWinner={winner === "A"}
            barColor={barColor}
          />
          <ScoreBar
            label="Ad B"
            score={winner === "B" ? winnerScore : loserScore}
            isWinner={winner === "B"}
            barColor={barColor}
          />
        </div>

        {/* Margin summary */}
        <div className={`text-[13px] ${labelColor} opacity-85 leading-relaxed`}>
          {isTied
            ? `Overall margin of ${lead} point${lead === 1 ? "" : "s"} — below our noise threshold. Consider running again or adjusting the audience profile.`
            : <>Overall margin: <span className="mono font-medium">{lead} points</span>
                {confidence === "low"    && " — directional signal only, not a final answer."}
                {confidence === "medium" && " — robust enough to act on with modest caution."}
                {confidence === "high"   && " — robust across multiple signal dimensions."}
              </>
          }
        </div>
      </div>
    </div>
  )
}

function ScoreBar({
  label, score, isWinner, barColor,
}: { label: string; score: number; isWinner: boolean; barColor: string }) {
  return (
    <div className="flex items-center gap-3.5">
      <div className={`text-[12px] mono w-9 shrink-0 ${isWinner ? "text-txt-primary font-semibold" : "text-txt-tertiary"}`}>
        {label}
      </div>
      <div className="flex-1 h-2.5 rounded-full bg-white/60 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${isWinner ? barColor : "bg-txt-tertiary/40"}`}
          style={{ width: `${Math.max(2, score)}%` }}
        />
      </div>
      <div className={`text-[14px] mono w-10 text-right tabular-nums ${isWinner ? "text-txt-primary font-semibold" : "text-txt-secondary"}`}>
        {score}
      </div>
    </div>
  )
}

function DiagnosisRow({
  rank, noun, verb, delta, winner,
}: { rank: number; noun: string; verb: string; delta: number; winner: "A" | "B" }) {
  return (
    <div className="flex items-start gap-3.5 py-3 px-4 bg-purple-25 rounded-lg border border-purple-50">
      <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-800 text-[11px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5 mono">
        {rank}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] text-txt-primary">
          <span className="font-medium capitalize">{noun}</span>{" "}
          <span className="text-txt-secondary">— Ad {winner} {verb}</span>
        </div>
        <div className="text-[12px] text-txt-tertiary mt-0.5 mono">
          +{delta} pts in Ad {winner}'s favor
        </div>
      </div>
    </div>
  )
}

function WeightBar({ label, weight }: { label: string; weight: number }) {
  const pct = Math.round(weight * 100)
  return (
    <div className="flex items-center gap-3">
      <div className="text-[12px] mono text-txt-secondary w-24 shrink-0 capitalize truncate">{label}</div>
      <div className="flex-1 h-2 rounded-full bg-border-dim/60 overflow-hidden">
        <div
          className="h-full bg-purple-400 rounded-full transition-all duration-300"
          style={{ width: `${pct * 3}%` }}
        />
      </div>
      <div className="text-[11px] mono text-txt-tertiary w-12 text-right">{(weight).toFixed(2)}</div>
    </div>
  )
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s
}