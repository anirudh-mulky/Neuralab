type Props = {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  disabled?: boolean
  maxChars?: number
}

export function TextSlot({
  label,
  value,
  onChange,
  placeholder,
  disabled,
  maxChars = 500,
}: Props) {
  const count = value.length
  const over = count > maxChars
  const countColor = over
    ? "text-amber-900"
    : count > maxChars * 0.8
    ? "text-purple-600"
    : "text-txt-tertiary"

  return (
    <div className="flex flex-col">
      <label className="text-[11px] uppercase tracking-[0.12em] text-txt-tertiary mb-2 mono">
        {label}
      </label>

      <div
        className={[
          "relative aspect-video rounded-xl border bg-bg-card overflow-hidden",
          "transition-colors flex flex-col",
          over ? "border-amber-900" : "border-border",
          disabled ? "opacity-60" : "",
        ].join(" ")}
      >
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className={[
            "flex-1 w-full p-5 md:p-6 resize-none bg-transparent outline-none",
            "font-display text-[20px] md:text-[24px] leading-[1.3] text-txt-primary",
            "placeholder:text-txt-tertiary/70 placeholder:font-sans placeholder:text-[14px]",
          ].join(" ")}
          maxLength={maxChars + 50}
        />

        <div className="flex items-center justify-between px-3 py-1.5 border-t border-border-dim bg-bg-muted">
          <div className="text-[10px] mono text-txt-tertiary tracking-wider uppercase">
            Headline / copy
          </div>
          <div className={`text-[10px] mono ${countColor}`}>
            {count} / {maxChars}
          </div>
        </div>
      </div>
    </div>
  )
}