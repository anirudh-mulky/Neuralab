import { useState } from "react"
import { ApiError, submitAnalysis, useJobPolling } from "./lib/api"
import type { MediaKind } from "./lib/types"
import { ResultsDashboard } from "./components/ResultsDashboard"
import { StateCard } from "./components/StateCard"
import { UploadSlot } from "./components/UploadSlot"

export default function App() {
  const [kind, setKind] = useState<MediaKind>("video")
  const [fileA, setFileA] = useState<File | null>(null)
  const [fileB, setFileB] = useState<File | null>(null)
  const [jobId, setJobId] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const { job, error: pollError } = useJobPolling(jobId)

  const isRunning = submitting || (job?.status === "running")
  const canSubmit = !!fileA && !!fileB && !isRunning

  const switchKind = (k: MediaKind) => {
    if (isRunning) return
    setKind(k)
    setFileA(null)
    setFileB(null)
    setJobId(null)
    setSubmitError(null)
  }

  const onSubmit = async () => {
    if (!fileA || !fileB) return
    setSubmitting(true)
    setSubmitError(null)
    setJobId(null)
    try {
      const { job_id } = await submitAnalysis(fileA, fileB, kind)
      setJobId(job_id)
    } catch (e) {
      setSubmitError(
        e instanceof ApiError
          ? `${e.status}: ${e.message}`
          : e instanceof Error
          ? e.message
          : "Submission failed"
      )
    } finally {
      setSubmitting(false)
    }
  }

  const reset = () => {
    setFileA(null)
    setFileB(null)
    setJobId(null)
    setSubmitError(null)
  }

  return (
    <div className="min-h-screen bg-bg-app grain">
      {/* Navbar */}
      <nav className="border-b border-border bg-bg-card">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#534AB7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 3 C6.5 3 5 5 5 7 C5 8.2 5.5 9 5 10 C4 11 4 13 5 14 C6 15 7 15 8 15 L8 21 L11 21 L11 10 M15 3 C17.5 3 19 5 19 7 C19 8.2 18.5 9 19 10 C20 11 20 13 19 14 C18 15 17 15 16 15 L16 21 L13 21 L13 10" />
              </svg>
            </div>
            <div>
              <div className="text-[15px] font-medium text-txt-primary display leading-none">
                NeuroLab
              </div>
              <div className="text-[10px] text-txt-tertiary mt-0.5 mono tracking-wider uppercase">
                Neural A/B · TRIBE v2
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-txt-secondary bg-bg-muted px-2.5 py-1.5 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />
            <span className="mono">online</span>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-4 pt-10 pb-6 relative z-10">
        <h1 className="text-[32px] md:text-[40px] font-medium text-txt-primary display leading-[1.15] max-w-2xl">
          Which ad does the <em className="text-purple-600 not-italic">brain</em> actually prefer?
        </h1>
        <p className="text-[14px] md:text-[15px] text-txt-secondary mt-3 leading-relaxed max-w-xl">
          Upload two versions. We predict the fMRI response using Meta FAIR's TRIBE v2, then score visual lock, attention, memory, and emotional pull — in under a minute.
        </p>
      </section>

      {/* Tabs + form */}
      <section className="max-w-4xl mx-auto px-4 pb-16 relative z-10">
        {/* Tab bar */}
        <div className="flex items-center gap-0 border-b border-border mb-5">
          <TabButton active={kind === "video"} onClick={() => switchKind("video")}>
            Video ads
          </TabButton>
          <TabButton active={kind === "image"} onClick={() => switchKind("image")}>
            Image ads
          </TabButton>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
          <UploadSlot label="Ad A" kind={kind} file={fileA} onChange={setFileA} disabled={isRunning} />
          <UploadSlot label="Ad B" kind={kind} file={fileB} onChange={setFileB} disabled={isRunning} />
        </div>

        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={onSubmit}
            disabled={!canSubmit}
            className={[
              "px-5 py-2.5 rounded-lg font-medium text-[14px] transition-colors",
              canSubmit
                ? "bg-purple-600 text-white hover:bg-purple-800"
                : "bg-border-dim text-txt-tertiary cursor-not-allowed",
            ].join(" ")}
          >
            {submitting ? "Submitting..." : isRunning ? "Analyzing..." : "Run neural analysis"}
          </button>

          {(job?.status === "done" || job?.status === "failed") && (
            <button
              onClick={reset}
              className="text-[13px] text-txt-secondary hover:text-txt-primary underline underline-offset-2"
            >
              Start over
            </button>
          )}
        </div>

        {/* Results area */}
        <div>
          {submitError && <ErrorBanner message={submitError} />}
          {pollError && <ErrorBanner message={`Connection lost: ${pollError}`} />}

          {!jobId && !submitError && (
            <StateCard
              title="Ready when you are."
              body="Upload two ads above and hit Run to see which one your audience's brain prefers."
            />
          )}

          {isRunning && job?.status === "running" && (
            <StateCard
              variant="running"
              title="Running neural analysis…"
              body={`${phaseText(job)} · usually 30-60s per ad on an A10G.`}
            />
          )}

          {job?.status === "failed" && (
            <ErrorBanner
              message={
                job.ad_a.error ?? job.ad_b.error ?? "Analysis failed. Check backend logs."
              }
            />
          )}

          {job?.status === "done" && job.ad_a.result && job.ad_b.result && (
            <ResultsDashboard resultA={job.ad_a.result} resultB={job.ad_b.result} />
          )}
        </div>
      </section>

      <footer className="max-w-4xl mx-auto px-4 pb-10 text-[11px] text-txt-tertiary mono relative z-10">
        TRIBE v2 · fsaverage5 cortical mesh · fMRI from 700+ subjects · Destrieux atlas mapping
      </footer>
    </div>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={[
        "px-4 py-2.5 text-[13px] font-medium transition-colors border-b-2 -mb-px",
        active
          ? "text-purple-600 border-purple-600"
          : "text-txt-secondary border-transparent hover:text-txt-primary",
      ].join(" ")}
    >
      {children}
    </button>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="bg-[#FFF4E0] border-l-[3px] border-[#F5A623] px-4 py-3 rounded-md text-[13px] text-[#5A3A05] leading-relaxed">
      <span className="font-medium">Something went wrong.</span> {message}
    </div>
  )
}

function phaseText(job: { ad_a: { status: string }; ad_b: { status: string } }): string {
  const done =
    (job.ad_a.status === "done" ? 1 : 0) + (job.ad_b.status === "done" ? 1 : 0)
  if (done === 0) return "Analyzing Ad A…"
  if (done === 1) return "Analyzing Ad B…"
  return "Finalizing…"
}
