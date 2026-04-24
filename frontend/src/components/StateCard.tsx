type Props = {
  title: string
  body: string
  variant?: "idle" | "running"
}

export function StateCard({ title, body, variant = "idle" }: Props) {
  return (
    <div
      className={[
        "rounded-xl border border-dashed px-6 py-10 text-center",
        variant === "running"
          ? "bg-purple-50 border-purple-200"
          : "bg-bg-muted border-border",
      ].join(" ")}
    >
      <div className="flex justify-center mb-4">
        {variant === "running" ? <Spinner /> : <BrainIcon />}
      </div>
      <div className="text-[15px] font-medium text-txt-secondary mb-1 display">
        {title}
      </div>
      <div className="text-[13px] text-txt-tertiary max-w-sm mx-auto">
        {body}
      </div>
    </div>
  )
}

function BrainIcon() {
  return (
    <svg
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#AFA9EC"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 3 C6.5 3 5 5 5 7 C5 8.2 5.5 9 5 10 C4 11 4 13 5 14 C6 15 7 15 8 15 L8 21 L11 21 L11 10 M15 3 C17.5 3 19 5 19 7 C19 8.2 18.5 9 19 10 C20 11 20 13 19 14 C18 15 17 15 16 15 L16 21 L13 21 L13 10" />
    </svg>
  )
}

function Spinner() {
  return (
    <div className="w-8 h-8 rounded-full border-2 border-purple-200 border-t-purple-600 animate-spin" />
  )
}
