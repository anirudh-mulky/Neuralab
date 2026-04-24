type Variant = "idle" | "running"

type Props = {
  title: string
  body: string
  variant?: Variant
  phases?: string[]             // narrative phases for running state
  phaseIndex?: number           // which phase is current (0-indexed)
}

export function StateCard({
  title, body, variant = "idle", phases, phaseIndex = 0,
}: Props) {
  if (variant === "running") {
    return <RunningCard title={title} body={body} phases={phases} phaseIndex={phaseIndex} />
  }
  return <IdleCard title={title} body={body} />
}

function IdleCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="relative rounded-2xl border border-dashed border-border bg-bg-card px-6 py-10 text-center overflow-hidden">
      {/* Subtle decorative dot pattern */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle at center, #534AB7 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div className="relative">
        <div className="w-10 h-10 mx-auto rounded-full bg-bg-muted border border-border-dim flex items-center justify-center mb-4">
          <div className="w-2 h-2 rounded-full bg-purple-400/60" />
        </div>
        <div className="text-[18px] font-medium text-txt-primary display mb-1.5">
          {title}
        </div>
        <div className="text-[13px] text-txt-secondary max-w-md mx-auto leading-relaxed">
          {body}
        </div>
      </div>
    </div>
  )
}

function RunningCard({
  title, body, phases, phaseIndex,
}: { title: string; body: string; phases?: string[]; phaseIndex: number }) {
  const effectivePhases = phases && phases.length > 0 ? phases : [body]

  return (
    <div className="relative rounded-2xl bg-purple-50 border border-purple-100 px-6 py-9 overflow-hidden">
      {/* Subtle animated gradient sheen */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none animate-pulse"
        style={{
          background: "radial-gradient(ellipse at 30% 40%, rgba(255,255,255,0.6), transparent 60%)",
          animationDuration: "3s",
        }}
      />

      <div className="relative text-center">
        {/* Orchestrated ring spinner — two concentric rings with different tempos */}
        <div className="relative w-12 h-12 mx-auto mb-5">
          <div className="absolute inset-0 rounded-full border-2 border-purple-100" />
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-purple-600 animate-spin" style={{ animationDuration: "1.2s" }} />
          <div className="absolute inset-2 rounded-full border border-transparent border-r-purple-400 animate-spin" style={{ animationDuration: "2s", animationDirection: "reverse" }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse" />
          </div>
        </div>

        <div className="text-[18px] font-medium text-purple-900 display mb-4">
          {title}
        </div>

        {/* Phase sequence — active phase highlighted, past phases ticked */}
        {phases && phases.length > 0 ? (
          <div className="max-w-sm mx-auto space-y-1.5">
            {effectivePhases.map((phase, i) => {
              const isDone = i < phaseIndex
              const isCurrent = i === phaseIndex
              return (
                <div
                  key={`${phase}-${i}`}
                  className={[
                    "flex items-center gap-2.5 text-left text-[12px] transition-all duration-300",
                    isDone ? "text-teal-700" : isCurrent ? "text-purple-900 font-medium" : "text-txt-tertiary opacity-50",
                  ].join(" ")}
                >
                  <span className="w-4 flex justify-center mono">
                    {isDone ? "✓" : isCurrent ? <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-600 animate-pulse" /> : "·"}
                  </span>
                  <span>{phase}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-[13px] text-purple-800 max-w-md mx-auto leading-relaxed">
            {body}
          </div>
        )}

        <div className="text-[11px] text-purple-600/70 mt-4 mono">
          usually 30–60s per variant · first run after idle may take longer
        </div>
      </div>
    </div>
  )
}