export type MetricKey =
  | "visual"
  | "auditory"
  | "language"
  | "attention"
  | "reward"
  | "memory"

export type Metrics = Record<MetricKey, number>

export type AdTiming = {
  inference_sec: number
  peak_vram_gb: number
  n_timesteps: number
}

export type AdResult = {
  filename: string
  metrics: Metrics
  timing: AdTiming
}

export type AdSlot = {
  filename: string
  status: "running" | "done" | "failed"
  result: AdResult | null
  error: string | null
}

export type Job = {
  job_id: string
  status: "running" | "done" | "failed"
  kind: "video" | "image"
  created_at: number
  ad_a: AdSlot
  ad_b: AdSlot
}

export type MediaKind = "video" | "image"
