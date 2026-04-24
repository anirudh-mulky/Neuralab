import { useState } from "react"
import {
  AGE_BRACKETS, AGE_ORDER, MARKETS, MARKET_ORDER, confidenceFor,
} from "../lib/calibration"
import type { AgeBracket, MarketId } from "../lib/calibration"

type Props = {
  market: MarketId
  age: AgeBracket
  onMarketChange: (m: MarketId) => void
  onAgeChange: (a: AgeBracket) => void
  disabled?: boolean
}

/**
 * Composite audience-selection control. Three panels:
 *   1. Market picker (segmented, single-select)
 *   2. Age picker (segmented, smaller)
 *   3. Live confidence badge (reflects the selected market's calibration layer)
 *
 * Designed to feel like a premium tool — not a form. Transitions smoothly,
 * confidence indicator updates as selections change, citation available on
 * expand for users who want the epistemic detail.
 */
export function AudienceSelector({
  market, age, onMarketChange, onAgeChange, disabled = false,
}: Props) {
  const [citationOpen, setCitationOpen] = useState(false)
  const profile = MARKETS[market]
  const conf = confidenceFor(profile.layer)

  return (
    <div className="mb-6">
      {/* Header row — eyebrow + confidence badge share a line */}
      <div className="flex items-baseline justify-between mb-2.5">
        <div className="text-[10px] text-txt-tertiary mono tracking-[0.14em] uppercase">
          Audience profile
        </div>
        <button
          onClick={() => setCitationOpen((v) => !v)}
          className={[
            "flex items-center gap-1.5 text-[10px] mono tracking-[0.06em] uppercase",
            "transition-colors hover:opacity-80",
            conf.textColor,
          ].join(" ")}
          title="Show calibration details"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${conf.dotColor}`} />
          <span>{conf.shortLabel}</span>
          <span className={`text-[8px] transition-transform ${citationOpen ? "rotate-180" : ""}`}>▾</span>
        </button>
      </div>

      {/* Main control surface — market above, age below */}
      <div className="rounded-xl border border-border bg-bg-card overflow-hidden">
        {/* MARKET picker — horizontal scroll on small screens, wrap on larger */}
        <div className="px-3 py-2.5 border-b border-border-dim">
          <MarketRow
            market={market}
            disabled={disabled}
            onChange={onMarketChange}
          />
        </div>

        {/* AGE picker — smaller, quieter */}
        <div className="px-3 py-2 flex items-center gap-3 bg-bg-muted/40">
          <div className="text-[10px] text-txt-tertiary mono tracking-[0.1em] uppercase shrink-0">
            Age
          </div>
          <AgeRow
            age={age}
            disabled={disabled}
            onChange={onAgeChange}
          />
        </div>
      </div>

      {/* Expanded citation block — revealed on badge click */}
      {citationOpen && (
        <div className="mt-2 px-3.5 py-2.5 rounded-lg bg-bg-card border border-border-dim">
          <div className="text-[10px] text-txt-tertiary mono tracking-[0.08em] uppercase mb-1.5">
            Calibration basis
          </div>
          <div className="text-[12px] text-txt-secondary leading-relaxed">
            {profile.citationNote}
          </div>
          <div className="text-[10px] text-txt-tertiary mt-2 leading-relaxed">
            Directional shifts grounded in peer-reviewed cross-cultural and aging neuroscience.
            Exact weights are calibrated heuristics, not fitted against per-market viewer data.
            The grey indicator reflects this: literature-adjusted, not empirically validated for this market.
          </div>
        </div>
      )}
    </div>
  )
}

function MarketRow({
  market, disabled, onChange,
}: {
  market: MarketId
  disabled?: boolean
  onChange: (m: MarketId) => void
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar -mx-0.5 px-0.5">
      {MARKET_ORDER.map((m) => {
        const profile = MARKETS[m]
        const isActive = m === market
        return (
          <button
            key={m}
            onClick={() => !disabled && onChange(m)}
            disabled={disabled}
            className={[
              "shrink-0 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all",
              "flex items-center gap-2 whitespace-nowrap",
              isActive
                ? "bg-purple-600 text-white shadow-sm"
                : "text-txt-secondary hover:bg-bg-muted hover:text-txt-primary",
              disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
            ].join(" ")}
          >
            <span
              className={[
                "text-[10px] mono tracking-wider",
                isActive ? "text-white/80" : "text-txt-tertiary",
              ].join(" ")}
            >
              {profile.flagGlyph}
            </span>
            <span>{profile.shortLabel}</span>
          </button>
        )
      })}
    </div>
  )
}

function AgeRow({
  age, disabled, onChange,
}: {
  age: AgeBracket
  disabled?: boolean
  onChange: (a: AgeBracket) => void
}) {
  return (
    <div className="flex items-center gap-0.5 flex-wrap">
      {AGE_ORDER.map((a, i) => {
        const isActive = a === age
        return (
          <button
            key={a}
            onClick={() => !disabled && onChange(a)}
            disabled={disabled}
            className={[
              "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap",
              isActive
                ? "bg-bg-card text-txt-primary shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                : "text-txt-secondary hover:bg-bg-card/60 hover:text-txt-primary",
              disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
              // Separator between non-adjacent active states
              i > 0 && !isActive ? "relative" : "",
            ].join(" ")}
          >
            {AGE_BRACKETS[a].short}
          </button>
        )
      })}
    </div>
  )
}