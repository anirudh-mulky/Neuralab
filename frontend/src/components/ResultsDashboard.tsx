import { useState } from "react"
import type { AdResult, MetricKey, Metrics } from "../lib/types"
import { BrainMap } from "./BrainMap"
import { MetricCard } from "./MetricCard"

type Props = {
  resultA: AdResult
  resultB: AdResult
}

type DisplayMetric = { key: MetricKey; name: string; desc: string }

// Only 4 of the 6 signals are exposed in the UI — audio branch is stripped
// and language is tied to speech, which we don't use on short ads.
const DISPLAY_METRICS: DisplayMetric[] = [
  { key: "visual",    name: "Eye-catching",    desc: "how much the eye locks on" },
  { key: "attention", name: "Holds attention", desc: "how long focus stays engaged" },
  { key: "memory",    name: "Memorable",       desc: "how likely it is to stick" },
  { key: "reward",    name: "Emotional pull",  desc: "the feel-good response" },
]

function pickWinner(a: Metrics, b: Metrics) {
  const keys: MetricKey[] = ["visual", "attention", "memory", "reward"]
  const avg = (m: Metrics) => keys.reduce((s, k) => s + (m[k] ?? 0), 0) / keys.length
  const sa = avg(a)
  const sb = avg(b)
  const lead = Math.abs(sa - sb)
  return sa >= sb
    ? { winner: "A" as const, lead: Math.round(lead), scoreW: Math.round(sa), scoreL: Math.round(sb) }
    : { winner: "B" as const, lead: Math.round(lead), scoreW: Math.round(sb), scoreL: Math.round(sa) }
}

function writeExplanation(winner: "A" | "B", a: Metrics, b: Metrics): string {
  const reasons: Record<MetricKey, string> = {
    visual: "catches the eye harder",
    attention: "holds attention longer",
    memory: "is more memorable",
    reward: "has stronger emotional pull",
    auditory: "",
    language: "",
  }
  const winsBy: Array<[MetricKey, number]> = []
  for (const k of ["visual", "attention", "memory", "reward"] as MetricKey[]) {
    const d = winner === "A" ? (a[k] ?? 0) - (b[k] ?? 0) : (b[k] ?? 0) - (a[k] ?? 0)
    if (d > 0) winsBy.push([k, d])
  }
  if (winsBy.length === 0)
    return `Ad ${winner} edges out by a narrow margin across the board.`
  winsBy.sort(([, x], [, y]) => y - x)
  const top = winsBy.slice(0, 2).map(([k]) => reasons[k])
  return top.length === 1
    ? `It ${top[0]} than the other.`
    : `It ${top[0]} and ${top[1]}.`
}

export function ResultsDashboard({ resultA, resultB }: Props) {
  const [brainsOpen, setBrainsOpen] = useState(false)

  const mA = resultA.metrics
  const mB = resultB.metrics
  const { winner, lead } = pickWinner(mA, mB)
  const confidence = Math.min(Math.round(50 + lead * 1.8), 95)
  const winnerFile = winner === "A" ? resultA.filename : resultB.filename
  const explanation = writeExplanation(winner, mA, mB)

  return (
    <div className="space-y-4">
      {/* Winner */}
      <div className="bg-teal-50 rounded-xl p-4 md:p-5">
        <div className="flex items-center gap-2.5 mb-2">
          <div className="w-[22px] h-[22px] rounded-full bg-teal-500 text-white text-[13px] font-bold flex items-center justify-center leading-none">
            ✓
          </div>
          <div className="text-[11px] text-teal-600 font-medium tracking-[0.08em] mono uppercase">
            Winner · {confidence}% confidence
          </div>
        </div>
        <div className="text-[20px] md:text-[22px] font-medium text-teal-800 display">
          Ad {winner} is likely to perform better.
        </div>
        <div className="text-[12px] text-teal-700 mono mt-1 truncate">
          {winnerFile}
        </div>
        <div className="text-[13px] text-teal-700 mt-2 leading-relaxed">
          {explanation} Overall, Ad {winner} leads by {lead} points.
        </div>
      </div>

      {/* Metrics */}
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-medium text-txt-primary display">
          How each ad performed
        </h2>
        <span className="text-[11px] text-txt-tertiary mono">
          4 of 6 signals · 2 unavailable
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
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

      {/* Notice */}
      <div className="bg-bg-muted rounded-lg px-3 py-2.5 flex items-start gap-2.5">
        <div className="w-4 h-4 rounded-full bg-border text-txt-secondary flex items-center justify-center flex-shrink-0 text-[10px] font-semibold font-display mt-0.5">
          i
        </div>
        <div className="text-[11px] text-txt-secondary leading-relaxed">
          <span className="text-txt-primary font-medium">
            Sound &amp; message response not measured.
          </span>{" "}
          Audio is removed before analysis — that path is on the roadmap.
        </div>
      </div>

      {/* Brain details */}
      <details
        open={brainsOpen}
        onToggle={(e) =>
          setBrainsOpen((e.target as HTMLDetailsElement).open)
        }
        className="bg-bg-card border border-border rounded-xl overflow-hidden"
      >
        <summary className="px-4 py-3 cursor-pointer list-none flex items-center justify-between">
          <div>
            <div className="text-[15px] font-medium text-txt-primary display">
              Brain response maps
            </div>
            <div className="text-[11px] text-txt-tertiary">
              The fMRI prediction behind the numbers — for the curious
            </div>
          </div>
          <div
            className={`text-txt-tertiary text-xs transition-transform ${
              brainsOpen ? "rotate-180" : ""
            }`}
          >
            ▾
          </div>
        </summary>
        <div className="px-4 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1.5">
            <div>
              <div className="text-[10px] text-txt-tertiary tracking-[0.08em] mb-1.5 mono truncate">
                AD A · {resultA.filename}
              </div>
              <BrainMap metrics={mA} label="Ad A" />
            </div>
            <div>
              <div className="text-[10px] text-txt-tertiary tracking-[0.08em] mb-1.5 mono truncate">
                AD B · {resultB.filename}
              </div>
              <BrainMap metrics={mB} label="Ad B" />
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-border-dim text-[10px] text-txt-tertiary leading-relaxed">
            Darker circle = stronger predicted brain response. Numbers are
            0-100 intensity scores. Powered by Meta FAIR's TRIBE v2, trained on
            fMRI from 700+ people watching movies and podcasts.
          </div>
        </div>
      </details>

      {/* Perf stats footer */}
      <div className="text-[10px] text-txt-tertiary mono flex items-center gap-4 pt-1">
        <span>A · {resultA.timing.inference_sec}s · {resultA.timing.peak_vram_gb}GB VRAM</span>
        <span className="text-border">|</span>
        <span>B · {resultB.timing.inference_sec}s · {resultB.timing.peak_vram_gb}GB VRAM</span>
      </div>
    </div>
  )
}
