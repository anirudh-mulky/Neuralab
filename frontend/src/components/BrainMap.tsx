import type { Metrics } from "../lib/types"

type Props = {
  metrics: Metrics
  label: string
}

// Region → (cx, cy)
const POSITIONS: Record<keyof Metrics, [number, number]> = {
  attention: [105, 52],
  reward:    [148, 62],
  memory:    [172, 94],
  visual:    [210, 98],
  auditory:  [138, 130],
  language:  [78,  106],
}

// Region → (plain-language label, x, y, anchor)
const LABELS: Record<
  keyof Metrics,
  { text: string; x: number; y: number; anchor: "start" | "middle" | "end" }
> = {
  attention: { text: "attention", x: 105, y: 32,  anchor: "middle" },
  reward:    { text: "emotion",   x: 148, y: 44,  anchor: "middle" },
  memory:    { text: "memory",    x: 172, y: 77,  anchor: "middle" },
  visual:    { text: "seeing",    x: 210, y: 122, anchor: "middle" },
  auditory:  { text: "hearing",   x: 138, y: 148, anchor: "middle" },
  language:  { text: "words",     x: 55,  y: 108, anchor: "end"    },
}

function intensityStyle(v: number): { fill: string; text: string; r: number; fontSize: number } {
  if (v >= 75) return { fill: "#3C3489", text: "white",   r: 16, fontSize: 11 }
  if (v >= 55) return { fill: "#534AB7", text: "white",   r: 15, fontSize: 11 }
  if (v >= 35) return { fill: "#7F77DD", text: "white",   r: 13, fontSize: 11 }
  if (v >= 20) return { fill: "#AFA9EC", text: "#26215C", r: 11, fontSize: 9  }
  return         { fill: "#CECBF6", text: "#3C3489", r: 9,  fontSize: 9  }
}

export function BrainMap({ metrics, label }: Props) {
  return (
    <svg
      viewBox="0 0 260 160"
      className="w-full h-auto block"
      role="img"
      aria-label={`Brain activation map for ${label}`}
    >
      {/* Brain silhouette */}
      <path
        d="M 45 90 C 32 62, 60 34, 95 32 C 125 30, 145 36, 160 32 C 195 26, 230 42, 235 72 C 240 95, 228 125, 200 138 C 170 150, 135 150, 108 145 C 85 142, 62 132, 50 112 C 42 104, 43 97, 45 90 Z"
        fill="#F4F2EA"
        stroke="#DDDACB"
        strokeWidth="0.8"
      />

      {/* Region circles with values */}
      {(Object.keys(POSITIONS) as Array<keyof Metrics>).map((k) => {
        const [cx, cy] = POSITIONS[k]
        const v = Math.round(metrics[k] ?? 0)
        const s = intensityStyle(v)
        return (
          <g key={`c-${k}`}>
            <circle cx={cx} cy={cy} r={s.r} fill={s.fill} />
            <text
              x={cx}
              y={cy + 3.5}
              textAnchor="middle"
              fontSize={s.fontSize}
              fontWeight={500}
              fill={s.text}
              className="mono"
            >
              {v}
            </text>
          </g>
        )
      })}

      {/* Plain-language region labels */}
      {(Object.keys(LABELS) as Array<keyof Metrics>).map((k) => {
        const L = LABELS[k]
        return (
          <text
            key={`l-${k}`}
            x={L.x}
            y={L.y}
            textAnchor={L.anchor}
            fontSize="8"
            fill="#999999"
          >
            {L.text}
          </text>
        )
      })}
    </svg>
  )
}
