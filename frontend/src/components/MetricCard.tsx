type Props = {
  name: string
  desc: string
  valA: number
  valB: number
}

export function MetricCard({ name, desc, valA, valB }: Props) {
  const diff = valA - valB

  const leadBg = diff > 0 ? "bg-teal-50" : diff < 0 ? "bg-amber-50" : "bg-[#EEEEEE]"
  const leadFg = diff > 0 ? "text-teal-600" : diff < 0 ? "text-amber-900" : "text-[#555]"
  const leadText = diff === 0 ? "Tied" : diff > 0 ? `A +${diff}` : `B +${-diff}`

  const fillA = diff > 0 ? "bg-teal-500" : diff < 0 ? "bg-purple-400" : "bg-purple-400"
  const fillB = diff < 0 ? "bg-teal-500" : diff > 0 ? "bg-purple-400" : "bg-purple-400"
  const colorA = diff >= 0 ? "text-txt-primary" : "text-txt-tertiary"
  const colorB = diff <= 0 ? "text-txt-primary" : "text-txt-tertiary"

  return (
    <div className="bg-bg-card border border-border rounded-lg px-3.5 py-3">
      <div className="flex items-center justify-between">
        <div className="text-[13px] font-medium text-txt-primary">{name}</div>
        <span
          className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full mono ${leadBg} ${leadFg}`}
        >
          {leadText}
        </span>
      </div>
      <div className="text-[11px] text-txt-tertiary mb-2">{desc}</div>

      <Bar label="A" value={valA} fill={fillA} color={colorA} />
      <Bar label="B" value={valB} fill={fillB} color={colorB} />
    </div>
  )
}

function Bar({
  label,
  value,
  fill,
  color,
}: {
  label: string
  value: number
  fill: string
  color: string
}) {
  return (
    <div className="grid grid-cols-[22px_1fr_30px] gap-2 items-center mt-1.5 text-[11px]">
      <span className="text-txt-tertiary">{label}</span>
      <div className="h-[5px] bg-border-dim rounded-[3px] overflow-hidden">
        <div
          className={`h-full rounded-[3px] ${fill}`}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
      <span className={`mono font-medium text-right text-[12px] ${color}`}>
        {value}
      </span>
    </div>
  )
}
