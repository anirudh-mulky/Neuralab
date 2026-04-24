import { useEffect, useMemo, useState } from "react"
import { BrowserRouter, NavLink, Navigate, Route, Routes } from "react-router-dom"
import { ApiError, submitAnalysis, useJobPolling } from "./lib/api"
import type { AdResult, Job, MediaKind, MetricKey, Metrics } from "./lib/types"
import { AudienceSelector } from "./components/AudienceSelector"
import { ResultsDashboard } from "./components/ResultsDashboard"
import { StateCard } from "./components/StateCard"
import { TextSlot } from "./components/TextSlot"
import { UploadSlot } from "./components/UploadSlot"
import type { AgeBracket, MarketId } from "./lib/calibration"
import { overallScore } from "./lib/calibration"

const NAV_ITEMS = [
  { to: "/video",   label: "Video ads",        caption: "Short-form, 15–60s spots"    },
  { to: "/image",   label: "Image ads",        caption: "Static creative variants"    },
  { to: "/text",    label: "Text ads",         caption: "Headlines + body copy"       },
  { to: "/landing", label: "Landing creative", caption: "Hero + layout variations"    },
]

// ═══════════════════════════════════════════════════════════════
//   History (unchanged)
// ═══════════════════════════════════════════════════════════════

const HISTORY_KEY = "neurolab:history:v1"
const HISTORY_EVENT = "neurolab:history:updated"

type HistoryItem = {
  id: string
  timestamp: number
  kind: MediaKind
  labelA: string
  labelB: string
  resultA: AdResult
  resultB: AdResult
  winner: "A" | "B"
  lead: number
}

function readHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    return raw ? (JSON.parse(raw) as HistoryItem[]) : []
  } catch { return [] }
}

function pushHistory(item: HistoryItem) {
  const existing = readHistory()
  if (existing.some((e) => e.id === item.id)) return
  const next = [item, ...existing].slice(0, 20)
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
    window.dispatchEvent(new CustomEvent(HISTORY_EVENT))
  } catch {/* ignore */}
}

function clearHistory() {
  try {
    localStorage.removeItem(HISTORY_KEY)
    window.dispatchEvent(new CustomEvent(HISTORY_EVENT))
  } catch {/* ignore */}
}

function useHistory(): HistoryItem[] {
  const [items, setItems] = useState<HistoryItem[]>(() => readHistory())
  useEffect(() => {
    const reload = () => setItems(readHistory())
    window.addEventListener(HISTORY_EVENT, reload)
    window.addEventListener("storage", reload)
    return () => {
      window.removeEventListener(HISTORY_EVENT, reload)
      window.removeEventListener("storage", reload)
    }
  }, [])
  return items
}

function useRecordHistory(job: Job | null, kind: MediaKind) {
  useEffect(() => {
    if (job?.status === "done" && job.ad_a.result && job.ad_b.result) {
      const a = job.ad_a.result, b = job.ad_b.result
      const sA = overallScore(a.metrics), sB = overallScore(b.metrics)
      pushHistory({
        id: job.job_id,
        timestamp: Date.now(),
        kind,
        labelA: a.filename,
        labelB: b.filename,
        resultA: a,
        resultB: b,
        winner: sA >= sB ? "A" : "B",
        lead: Math.round(Math.abs(sA - sB)),
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.job_id, job?.status])
}

// ═══════════════════════════════════════════════════════════════
//   Session-level audience state
// ═══════════════════════════════════════════════════════════════

const AUDIENCE_EVENT = "neurolab:audience:updated"
let sessionMarket: MarketId = "global"
let sessionAge: AgeBracket  = "18_34"

function useAudience() {
  const [market, setMarketState] = useState<MarketId>(sessionMarket)
  const [age, setAgeState]       = useState<AgeBracket>(sessionAge)

  useEffect(() => {
    const sync = () => { setMarketState(sessionMarket); setAgeState(sessionAge) }
    window.addEventListener(AUDIENCE_EVENT, sync)
    return () => window.removeEventListener(AUDIENCE_EVENT, sync)
  }, [])

  const setMarket = (m: MarketId) => {
    sessionMarket = m
    setMarketState(m)
    window.dispatchEvent(new CustomEvent(AUDIENCE_EVENT))
  }
  const setAge = (a: AgeBracket) => {
    sessionAge = a
    setAgeState(a)
    window.dispatchEvent(new CustomEvent(AUDIENCE_EVENT))
  }
  return { market, age, setMarket, setAge }
}

// ═══════════════════════════════════════════════════════════════
//   App shell
//
//   Layout strategy (no more overlap):
//   - Max width 1280px (fits on MacBook 13" and up without wasting space)
//   - 3-column desktop grid: 200px sidebar / fluid main / 260px history
//   - Stacks vertically below lg (1024px)
//   - NO nested cards with fixed-width inner columns — that was the overlap source
// ═══════════════════════════════════════════════════════════════

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-bg-app grain">
        <NavBar />

        <div className="max-w-[1280px] mx-auto px-5 md:px-8 pt-10 pb-20 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr_260px] gap-8 lg:gap-10">
            <aside className="order-2 lg:order-1 lg:sticky lg:top-24 h-fit">
              <SidebarNav />
            </aside>

            <main className="order-1 lg:order-2 min-w-0">
              <Routes>
                <Route path="/" element={<Navigate to="/video" replace />} />
                <Route path="/video"   element={<AnalysisWorkspace kind="video" />} />
                <Route path="/image"   element={<AnalysisWorkspace kind="image" />} />
                <Route path="/text"    element={<TextAnalysisWorkspace />} />
                <Route path="/landing" element={<LandingAnalysisWorkspace />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </main>

            <aside className="order-3 lg:order-3 lg:sticky lg:top-24 h-fit">
              <HistoryCard />
            </aside>
          </div>
        </div>

        <footer className="max-w-[1280px] mx-auto px-5 md:px-8 pb-10 text-[12px] text-txt-tertiary mono relative z-10 border-t border-border-dim pt-6 flex items-center justify-between flex-wrap gap-3">
          <span>TRIBE v2 · fsaverage5 cortical mesh · 20,484 vertices at 1Hz</span>
          <span>Destrieux atlas mapping · Meta FAIR · CC BY-NC</span>
        </footer>
      </div>
    </BrowserRouter>
  )
}

function NavBar() {
  return (
    <nav className="border-b border-border gradient-navbar relative z-10">
      <div className="max-w-[1280px] mx-auto px-5 md:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center shadow-[0_1px_2px_rgba(83,74,183,0.08)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 3 C6.5 3 5 5 5 7 C5 8.2 5.5 9 5 10 C4 11 4 13 5 14 C6 15 7 15 8 15 L8 21 L11 21 L11 10 M15 3 C17.5 3 19 5 19 7 C19 8.2 18.5 9 19 10 C20 11 20 13 19 14 C18 15 17 15 16 15 L16 21 L13 21 L13 10" />
            </svg>
          </div>
          <div>
            <div className="text-[17px] font-medium text-txt-primary display leading-none">
              NeuroLab
            </div>
            <div className="text-[11px] text-txt-tertiary mt-1.5 mono tracking-[0.14em] uppercase">
              Neural A/B · TRIBE v2
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[12px] text-txt-secondary bg-bg-muted px-3 py-1.5 rounded-full">
          <div className="w-1.5 h-1.5 rounded-full bg-teal-500 shadow-[0_0_0_3px_rgba(29,158,117,0.15)]" />
          <span className="mono">online</span>
        </div>
      </div>
    </nav>
  )
}

function SidebarNav() {
  return (
    <div className="bg-bg-card border border-border rounded-xl p-5">
      <div className="text-[11px] text-txt-tertiary mono tracking-[0.14em] uppercase">
        A/B testing
      </div>
      <div className="text-[17px] font-medium text-txt-primary display mt-1.5">
        Formats
      </div>
      <div className="mt-4 space-y-1.5">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end
            className={({ isActive }) =>
              [
                "group flex items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-all",
                isActive
                  ? "bg-bg-muted border-border text-txt-primary"
                  : "border-transparent text-txt-secondary hover:bg-bg-muted hover:text-txt-primary",
              ].join(" ")
            }
          >
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-purple-600 shrink-0" />
            <div>
              <div className="text-[13px] font-medium leading-tight">{item.label}</div>
              <div className="text-[11px] text-txt-tertiary mt-1 leading-snug">{item.caption}</div>
            </div>
          </NavLink>
        ))}
      </div>
      <div className="mt-5 border-t border-border-dim pt-4">
        <div className="text-[11px] text-txt-tertiary mono tracking-[0.14em] uppercase">
          Method
        </div>
        <div className="text-[12px] text-txt-secondary mt-1.5 leading-relaxed">
          Drop two variants. We predict the fMRI response and score four cognitive signals.
        </div>
      </div>
    </div>
  )
}

function NotFound() {
  return (
    <section className="pb-16">
      <div className="mb-7">
        <div className="text-[11px] text-txt-tertiary mono tracking-[0.14em] uppercase">404</div>
        <h1 className="text-[36px] md:text-[44px] font-medium text-txt-primary display leading-[1.1] mt-2">
          Not found
        </h1>
      </div>
      <StateCard title="Page not found." body="Pick a format from the sidebar to keep exploring." />
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════
//   HistoryCard
// ═══════════════════════════════════════════════════════════════

const KIND_GLYPH: Record<MediaKind, string> = {
  video: "▶", image: "◯", text: "T", landing: "▭",
}

function HistoryCard() {
  const items = useHistory()
  const [expanded, setExpanded] = useState<string | null>(null)

  return (
    <div className="bg-bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[11px] text-txt-tertiary mono tracking-[0.14em] uppercase">
            Recent runs
          </div>
          <div className="text-[17px] font-medium text-txt-primary display mt-1.5">
            Your history
          </div>
        </div>
        {items.length > 0 && (
          <button
            onClick={() => {
              if (window.confirm("Clear all run history?")) {
                clearHistory()
                setExpanded(null)
              }
            }}
            className="text-[11px] mono text-txt-tertiary hover:text-amber-900 underline underline-offset-2"
          >
            clear
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="mt-4 px-3.5 py-5 rounded-lg border border-dashed border-border-dim text-[12px] text-txt-tertiary text-center leading-relaxed">
          Nothing here yet. Your completed runs appear here, stored on this device.
        </div>
      ) : (
        <div className="mt-3.5 space-y-1 max-h-[440px] overflow-y-auto -mr-2 pr-2">
          {items.map((item) => (
            <HistoryRow
              key={item.id}
              item={item}
              isExpanded={expanded === item.id}
              onToggle={() => setExpanded(expanded === item.id ? null : item.id)}
            />
          ))}
        </div>
      )}

      <div className="mt-4 pt-3 border-t border-border-dim text-[11px] text-txt-tertiary leading-relaxed">
        Stored on this device · last 20 runs
      </div>
    </div>
  )
}

function HistoryRow({
  item, isExpanded, onToggle,
}: { item: HistoryItem; isExpanded: boolean; onToggle: () => void }) {
  const winnerLabel = item.winner === "A" ? item.labelA : item.labelB
  return (
    <div className="rounded-lg border border-transparent hover:border-border hover:bg-bg-muted transition-colors">
      <button onClick={onToggle} className="w-full flex items-start gap-2.5 px-2.5 py-2.5 text-left">
        <div className="w-7 h-7 rounded-md bg-purple-50 text-purple-600 flex items-center justify-center text-[12px] font-semibold flex-shrink-0">
          {KIND_GLYPH[item.kind]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] text-txt-primary font-medium truncate">
            <span className="text-purple-600">{item.winner}</span>{" "}
            {truncate(winnerLabel, 22)}
          </div>
          <div className="text-[11px] text-txt-tertiary mono mt-0.5">
            {timeAgo(item.timestamp)} · +{item.lead}pt {item.kind}
          </div>
        </div>
      </button>
      {isExpanded && (
        <div className="px-2.5 pb-3 space-y-1.5">
          <MiniMetric label="A" name={truncate(item.labelA, 24)} score={avgScore(item.resultA.metrics)} winner={item.winner === "A"} />
          <MiniMetric label="B" name={truncate(item.labelB, 24)} score={avgScore(item.resultB.metrics)} winner={item.winner === "B"} />
        </div>
      )}
    </div>
  )
}

function MiniMetric({
  label, name, score, winner,
}: { label: string; name: string; score: number; winner: boolean }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className={`mono w-3 ${winner ? "text-teal-600 font-bold" : "text-txt-tertiary"}`}>{label}</span>
      <span className={`flex-1 truncate ${winner ? "text-txt-primary" : "text-txt-tertiary"}`}>{name}</span>
      <span className={`mono ${winner ? "text-teal-600 font-medium" : "text-txt-tertiary"}`}>{score}</span>
    </div>
  )
}

function avgScore(m: Metrics): number {
  const keys: MetricKey[] = ["visual", "attention", "memory", "reward"]
  return Math.round(keys.reduce((s, k) => s + (m[k] ?? 0), 0) / keys.length)
}

function timeAgo(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 60)   return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  if (s < 86400) return `${Math.round(s / 3600)}h ago`
  return `${Math.round(s / 86400)}d ago`
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s
}

// ═══════════════════════════════════════════════════════════════
//   Editorial Hero — responsive scale that doesn't blow up
// ═══════════════════════════════════════════════════════════════

function EditorialHero({
  eyebrow, headline, italicWord, subcopy,
}: {
  eyebrow: string
  headline: string
  italicWord: string
  subcopy: string
}) {
  return (
    <section className="relative pb-10 pt-4 -mx-5 md:-mx-8 px-5 md:px-8 gradient-hero rounded-b-[24px]">
      <div className="text-[11px] text-txt-tertiary mono tracking-[0.18em] uppercase mb-4 flex items-center gap-2.5">
        <span className="w-5 h-px bg-border" />
        <span>{eyebrow}</span>
      </div>
      <h1 className="display-tight text-[34px] md:text-[44px] lg:text-[52px] font-medium text-txt-primary display leading-[1.05] max-w-[20ch]">
        {headline}{" "}
        <em className="text-purple-600 italic font-normal">{italicWord}</em>
        <span className="text-txt-primary">?</span>
      </h1>
      <p className="text-[15px] md:text-[16px] text-txt-secondary mt-5 leading-[1.55] max-w-[55ch]">
        {subcopy}
      </p>
    </section>
  )
}

// ═══════════════════════════════════════════════════════════════
//   Video + Image workspace — flat, clean, no nested cards
// ═══════════════════════════════════════════════════════════════

function AnalysisWorkspace({ kind }: { kind: "video" | "image" }) {
  const { market, age, setMarket, setAge } = useAudience()
  const [fileA, setFileA] = useState<File | null>(null)
  const [fileB, setFileB] = useState<File | null>(null)
  const [keepAudio, setKeepAudio] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const { job, error: pollError } = useJobPolling(jobId)
  useRecordHistory(job, kind)

  const isRunning = submitting || job?.status === "running"
  const canSubmit = !!fileA && !!fileB && !isRunning

  const onSubmit = async () => {
    if (!fileA || !fileB) return
    setSubmitting(true); setSubmitError(null); setJobId(null)
    try {
      const payload = kind === "video"
        ? { kind: "video" as const, adA: fileA, adB: fileB, keepAudio }
        : { kind: "image" as const, adA: fileA, adB: fileB }
      const { job_id } = await submitAnalysis(payload)
      setJobId(job_id)
    } catch (e) {
      setSubmitError(errMsg(e))
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setFileA(null); setFileB(null)
    setJobId(null); setSubmitError(null)
  }

  const isVideo = kind === "video"

  return (
    <div>
      <EditorialHero
        eyebrow={isVideo ? "Format · 01  Video ads" : "Format · 02  Image ads"}
        headline={isVideo ? "Which ad does the brain actually" : "Which still grabs attention"}
        italicWord={isVideo ? "prefer" : "faster"}
        subcopy={isVideo
          ? "Upload two cuts. We predict the fMRI response using Meta FAIR's TRIBE v2, then score visual lock, attention, memory, and emotional pull — in under a minute."
          : "Two static ads, scored on visual lock and emotional pull. Useful for display creative, social posts, and poster concepts."}
      />

      <section className="pb-16 pt-8">
        <div className="flex items-center gap-0 border-b border-border mb-6">
          <TabLink to="/video" disabled={isRunning}>Video ads</TabLink>
          <TabLink to="/image" disabled={isRunning}>Image ads</TabLink>
        </div>

        <AudienceSelector
          market={market} age={age}
          onMarketChange={setMarket} onAgeChange={setAge}
          disabled={isRunning}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
          <UploadSlot label="Ad A" kind={kind} file={fileA} onChange={setFileA} disabled={isRunning} />
          <UploadSlot label="Ad B" kind={kind} file={fileB} onChange={setFileB} disabled={isRunning} />
        </div>

        {kind === "video" && (
          <div className="mb-6">
            <label className="inline-flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={keepAudio}
                onChange={(e) => setKeepAudio(e.target.checked)}
                disabled={isRunning}
                className="mt-0.5 w-4 h-4 accent-purple-600 cursor-pointer disabled:cursor-not-allowed"
              />
              <span className="text-[13px] text-txt-secondary leading-snug">
                <span className="font-medium text-txt-primary">Keep audio (experimental)</span>{" "}
                <span className="text-txt-tertiary">
                  · TRIBE will run Whisper + Wav2Vec-BERT on the audio. May be unstable on short ads.
                </span>
              </span>
            </label>
          </div>
        )}

        <SubmitRow
          label="Run neural analysis"
          submitting={submitting} isRunning={isRunning} canSubmit={canSubmit}
          onSubmit={onSubmit}
          canReset={job?.status === "done" || job?.status === "failed"}
          onReset={reset}
        />

        <ResultsArea
          kind={kind} jobId={jobId} job={job}
          submitError={submitError} pollError={pollError}
          isRunning={isRunning}
          market={market} age={age}
          idleTitle="Ready when you are."
          idleBody={isVideo
            ? "Drop two video cuts above and hit Run to see which one your audience's brain prefers."
            : "Drop two image variants above to see how the brain responds to each."}
        />
      </section>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//   Text workspace
// ═══════════════════════════════════════════════════════════════

type TextMode = "headlines" | "body"

const TEXT_MODE: Record<TextMode, {
  label: string; placeholder: string; maxChars: number;
  slotLabels: [string, string]; hint: string; example: string;
}> = {
  headlines: {
    label: "Headlines",
    placeholder: "e.g. Stop scrolling. Start sleeping.",
    maxChars: 120,
    slotLabels: ["Headline A", "Headline B"],
    hint: "Short, punchy. Up to 120 characters — like a poster or subject line.",
    example: "~3–5s of brain response per headline",
  },
  body: {
    label: "Body copy",
    placeholder: "e.g. We tested 40 mattresses in 40 cities so you don't have to. Free returns, zero questions.",
    maxChars: 500,
    slotLabels: ["Body A", "Body B"],
    hint: "Longer copy — up to 500 characters. Great for emails, descriptions, or ad bodies.",
    example: "~8–12s of brain response per variant",
  },
}

function TextAnalysisWorkspace() {
  const { market, age, setMarket, setAge } = useAudience()
  const [mode, setMode] = useState<TextMode>("headlines")
  const [textA, setTextA] = useState("")
  const [textB, setTextB] = useState("")
  const [jobId, setJobId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const { job, error: pollError } = useJobPolling(jobId)
  useRecordHistory(job, "text")

  const cfg = TEXT_MODE[mode]
  const isRunning = submitting || job?.status === "running"

  const canSubmit = useMemo(() => {
    if (isRunning) return false
    return textA.trim().length > 0 && textB.trim().length > 0 &&
           textA.length <= cfg.maxChars && textB.length <= cfg.maxChars
  }, [isRunning, textA, textB, cfg.maxChars])

  const switchMode = (m: TextMode) => {
    if (isRunning || m === mode) return
    setMode(m); setTextA(""); setTextB("")
    setJobId(null); setSubmitError(null)
  }

  const onSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true); setSubmitError(null); setJobId(null)
    try {
      const { job_id } = await submitAnalysis({ kind: "text", textA, textB })
      setJobId(job_id)
    } catch (e) {
      setSubmitError(errMsg(e))
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setTextA(""); setTextB("")
    setJobId(null); setSubmitError(null)
  }

  return (
    <div>
      <EditorialHero
        eyebrow="Format · 03  Text ads"
        headline="Which line actually"
        italicWord="lands"
        subcopy="Type two variants. We render each as a short video with voiceover, then measure language comprehension, memory encoding, and emotional pull."
      />

      <section className="pb-16 pt-8">
        <div className="flex items-center gap-0 border-b border-border mb-6">
          {(Object.keys(TEXT_MODE) as TextMode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              disabled={isRunning}
              className={[
                "px-4 py-3 text-[14px] font-medium transition-colors border-b-2 -mb-px",
                mode === m
                  ? "text-purple-600 border-purple-600"
                  : "text-txt-secondary border-transparent hover:text-txt-primary",
                isRunning ? "cursor-not-allowed opacity-60" : "",
              ].join(" ")}
            >
              {TEXT_MODE[m].label}
            </button>
          ))}
        </div>

        <AudienceSelector
          market={market} age={age}
          onMarketChange={setMarket} onAgeChange={setAge}
          disabled={isRunning}
        />

        <TipRow items={[cfg.hint, cfg.example]} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
          <TextSlot label={cfg.slotLabels[0]} value={textA} onChange={setTextA}
                    placeholder={cfg.placeholder} disabled={isRunning} maxChars={cfg.maxChars} />
          <TextSlot label={cfg.slotLabels[1]} value={textB} onChange={setTextB}
                    placeholder={cfg.placeholder} disabled={isRunning} maxChars={cfg.maxChars} />
        </div>

        <SubmitRow
          label="Run neural analysis"
          submitting={submitting} isRunning={isRunning} canSubmit={canSubmit}
          onSubmit={onSubmit}
          canReset={job?.status === "done" || job?.status === "failed"}
          onReset={reset}
        />

        <ResultsArea
          kind="text" jobId={jobId} job={job}
          submitError={submitError} pollError={pollError}
          isRunning={isRunning} market={market} age={age}
          idleTitle="Two lines, one winner."
          idleBody="Type two variants above and hit Run to see which one the brain remembers better."
        />
      </section>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//   Landing workspace
// ═══════════════════════════════════════════════════════════════

type Viewport = "desktop" | "mobile"

const VIEWPORT: Record<Viewport, { label: string; hint: string }> = {
  desktop: { label: "Desktop", hint: "Full-page screenshots · 1280×800+ recommended" },
  mobile:  { label: "Mobile",  hint: "Portrait captures · iPhone-sized (390×844) land best" },
}

function LandingAnalysisWorkspace() {
  const { market, age, setMarket, setAge } = useAudience()
  const [viewport, setViewport] = useState<Viewport>("desktop")
  const [fileA, setFileA] = useState<File | null>(null)
  const [fileB, setFileB] = useState<File | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const { job, error: pollError } = useJobPolling(jobId)
  useRecordHistory(job, "landing")

  const isRunning = submitting || job?.status === "running"
  const canSubmit = !!fileA && !!fileB && !isRunning

  const switchViewport = (v: Viewport) => {
    if (isRunning || v === viewport) return
    setViewport(v); setFileA(null); setFileB(null)
    setJobId(null); setSubmitError(null)
  }

  const onSubmit = async () => {
    if (!fileA || !fileB) return
    setSubmitting(true); setSubmitError(null); setJobId(null)
    try {
      const { job_id } = await submitAnalysis({ kind: "landing", adA: fileA, adB: fileB })
      setJobId(job_id)
    } catch (e) {
      setSubmitError(errMsg(e))
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setFileA(null); setFileB(null)
    setJobId(null); setSubmitError(null)
  }

  return (
    <div>
      <EditorialHero
        eyebrow="Format · 04  Landing creative"
        headline="Which page actually"
        italicWord="hooks"
        subcopy="Drop two landing-page screenshots. Scored on visual focus, emotional tone, and what the brain remembers — so you know which hero wins before you ship it."
      />

      <section className="pb-16 pt-8">
        <div className="flex items-center gap-0 border-b border-border mb-6">
          {(Object.keys(VIEWPORT) as Viewport[]).map((v) => (
            <button
              key={v}
              onClick={() => switchViewport(v)}
              disabled={isRunning}
              className={[
                "px-4 py-3 text-[14px] font-medium transition-colors border-b-2 -mb-px",
                viewport === v
                  ? "text-purple-600 border-purple-600"
                  : "text-txt-secondary border-transparent hover:text-txt-primary",
                isRunning ? "cursor-not-allowed opacity-60" : "",
              ].join(" ")}
            >
              {VIEWPORT[v].label}
            </button>
          ))}
        </div>

        <AudienceSelector
          market={market} age={age}
          onMarketChange={setMarket} onAgeChange={setAge}
          disabled={isRunning}
        />

        <TipRow items={[
          VIEWPORT[viewport].hint,
          "Capture with Cmd+Shift+4 on Mac or your browser's full-page screenshot",
        ]} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
          <UploadSlot label="Page A" kind="image" file={fileA} onChange={setFileA} disabled={isRunning} />
          <UploadSlot label="Page B" kind="image" file={fileB} onChange={setFileB} disabled={isRunning} />
        </div>

        <SubmitRow
          label="Run neural analysis"
          submitting={submitting} isRunning={isRunning} canSubmit={canSubmit}
          onSubmit={onSubmit}
          canReset={job?.status === "done" || job?.status === "failed"}
          onReset={reset}
        />

        <ResultsArea
          kind="landing" jobId={jobId} job={job}
          submitError={submitError} pollError={pollError}
          isRunning={isRunning} market={market} age={age}
          idleTitle="Two pages, one winner."
          idleBody="Drop two landing-page screenshots above to see which layout the brain locks onto first."
        />
      </section>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
//   Shared helpers
// ═══════════════════════════════════════════════════════════════

function SubmitRow({
  label, submitting, isRunning, canSubmit, onSubmit, canReset, onReset,
}: {
  label: string; submitting: boolean; isRunning: boolean; canSubmit: boolean;
  onSubmit: () => void; canReset: boolean; onReset: () => void;
}) {
  return (
    <div className="flex items-center gap-4 mb-8">
      <button
        onClick={onSubmit}
        disabled={!canSubmit}
        className={[
          "px-6 py-3 rounded-lg font-medium text-[15px] transition-all",
          canSubmit
            ? "bg-purple-600 text-white hover:bg-purple-800 shadow-sm hover:shadow-md"
            : "bg-border-dim text-txt-tertiary cursor-not-allowed",
        ].join(" ")}
      >
        {submitting ? "Submitting…" : isRunning ? "Analyzing…" : label}
      </button>
      {canReset && (
        <button
          onClick={onReset}
          className="text-[14px] text-txt-secondary hover:text-txt-primary underline underline-offset-2"
        >
          Start over
        </button>
      )}
    </div>
  )
}

function ResultsArea({
  kind, jobId, job, submitError, pollError, isRunning,
  market, age, idleTitle, idleBody,
}: {
  kind: MediaKind
  jobId: string | null
  job: Job | null
  submitError: string | null
  pollError: string | null
  isRunning: boolean
  market: MarketId
  age: AgeBracket
  idleTitle: string
  idleBody: string
}) {
  const phases = PHASE_COPY[kind]
  const phaseIndex = (() => {
    if (!job || job.status !== "running") return 0
    const done = (job.ad_a.status === "done" ? 1 : 0) + (job.ad_b.status === "done" ? 1 : 0)
    return Math.min(done + 1, phases.length - 1)
  })()

  return (
    <div>
      {submitError && <ErrorBanner message={submitError} />}
      {pollError && <ErrorBanner message={`Connection lost: ${pollError}`} />}

      {!jobId && !submitError && (
        <StateCard title={idleTitle} body={idleBody} />
      )}

      {isRunning && job?.status === "running" && (
        <StateCard
          variant="running"
          title="Running neural analysis"
          body="Usually 30–60s per variant."
          phases={phases}
          phaseIndex={phaseIndex}
        />
      )}

      {job?.status === "failed" && (
        <ErrorBanner message={job.ad_a.error ?? job.ad_b.error ?? "Analysis failed. Check backend logs."} />
      )}

      {job?.status === "done" && job.ad_a.result && job.ad_b.result && (
        <ResultsDashboard
          resultA={job.ad_a.result}
          resultB={job.ad_b.result}
          market={market}
          age={age}
        />
      )}
    </div>
  )
}

function TabLink({ to, disabled, children }: { to: string; disabled?: boolean; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end
      aria-disabled={disabled}
      onClick={(e) => { if (disabled) e.preventDefault() }}
      className={({ isActive }) =>
        [
          "px-4 py-3 text-[14px] font-medium transition-colors border-b-2 -mb-px",
          isActive
            ? "text-purple-600 border-purple-600"
            : "text-txt-secondary border-transparent hover:text-txt-primary",
          disabled ? "text-txt-tertiary border-transparent cursor-not-allowed hover:text-txt-tertiary" : "",
        ].join(" ")
      }
    >
      {children}
    </NavLink>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="bg-[#FFF4E0] border-l-[3px] border-[#F5A623] px-4 py-3.5 rounded-md text-[14px] text-[#5A3A05] leading-relaxed">
      <span className="font-medium">Something went wrong.</span> {message}
    </div>
  )
}

function TipRow({ items }: { items: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 mb-6 text-[12px] text-txt-tertiary">
      {items.map((t, i) => (
        <span key={t} className="flex items-center gap-1.5">
          <span className="w-1 h-1 rounded-full bg-purple-400/70" />
          <span>{t}</span>
          {i < items.length - 1 && <span className="text-border ml-2" aria-hidden>·</span>}
        </span>
      ))}
    </div>
  )
}

const PHASE_COPY: Record<MediaKind, string[]> = {
  video: [
    "Preparing video · stripping audio",
    "Encoding frames with V-JEPA2",
    "Predicting cortical response",
    "Scoring & comparing",
  ],
  image: [
    "Preparing 3-second video",
    "Encoding frames with V-JEPA2",
    "Predicting cortical response",
    "Scoring & comparing",
  ],
  text: [
    "Synthesizing voiceover · espeak-ng",
    "Rendering text card video",
    "Predicting cortical response",
    "Scoring language & memory",
  ],
  landing: [
    "Preparing screenshot",
    "Encoding with V-JEPA2",
    "Predicting visual focus",
    "Scoring & comparing",
  ],
}

function errMsg(e: unknown): string {
  if (e instanceof ApiError) return `${e.status}: ${e.message}`
  if (e instanceof Error) return e.message
  return "Submission failed"
}