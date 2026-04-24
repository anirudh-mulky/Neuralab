type Props = {
  name: string
  desc: string
  valA: number
  valB: number
}

export function MetricCard({ name, desc, valA, valB }: Props) {
  const aWins = valA > valB
  const bWins = valB > valA
  const tied  = valA === valB
  const delta = Math.abs(valA - valB)

  return (
    <div className="bg-bg-card border border-border rounded-xl p-3.5 hover:border-border transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="text-[13px] font-medium text-txt-primary">
            {name}
          </div>
          <div className="text-[10px] text-txt-tertiary italic mt-0.5">
            {desc}
          </div>
        </div>
        {!tied && (
          <div className="text-[10px] mono text-txt-tertiary shrink-0">
            +{delta} {aWins ? "A" : "B"}
          </div>
        )}
      </div>

      {/* Bars */}
      <div className="space-y-1.5">
        <Bar label="A" value={valA} winner={aWins} />
        <Bar label="B" value={valB} winner={bWins} />
      </div>
    </div>
  )
}

function Bar({ label, value, winner }: { label: string; value: number; winner: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={[
        "text-[10px] mono w-3 shrink-0",
        winner ? "text-purple-600 font-semibold" : "text-txt-tertiary",
      ].join(" ")}>
        {label}
      </div>
      <div className="flex-1 h-1.5 rounded-full bg-bg-muted overflow-hidden">
        <div
          className={[
            "h-full rounded-full transition-all duration-500 ease-out",
            winner ? "bg-purple-600" : "bg-border",
          ].join(" ")}
          style={{ width: `${Math.max(2, value)}%` }}
        />
      </div>
      <div className={[
        "text-[11px] mono w-8 text-right tabular-nums",
        winner ? "text-txt-primary font-semibold" : "text-txt-secondary",
      ].join(" ")}>
        {value}
      </div>
    </div>
  )
}