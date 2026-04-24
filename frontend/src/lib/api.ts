import { useEffect, useRef, useState } from "react"
import type { Job, MediaKind } from "./types"

const API_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:8000"

export class ApiError extends Error {
  constructor(public status: number, msg: string) {
    super(msg)
  }
}

async function jsonOrThrow<T>(r: Response): Promise<T> {
  if (!r.ok) {
    let detail = r.statusText
    try {
      const body = await r.json()
      detail = body.detail ?? JSON.stringify(body)
    } catch { /* ignore */ }
    throw new ApiError(r.status, detail)
  }
  return r.json()
}

export async function health() {
  return jsonOrThrow<{ ok: boolean }>(await fetch(`${API_URL}/health`))
}

export async function submitAnalysis(
  adA: File,
  adB: File,
  kind: MediaKind,
): Promise<{ job_id: string; status: string }> {
  const fd = new FormData()
  fd.append("ad_a", adA)
  fd.append("ad_b", adB)
  fd.append("kind", kind)
  const r = await fetch(`${API_URL}/analyze`, { method: "POST", body: fd })
  return jsonOrThrow(r)
}

export async function fetchJob(jobId: string): Promise<Job> {
  return jsonOrThrow<Job>(await fetch(`${API_URL}/jobs/${jobId}`))
}

/**
 * Polls /jobs/{id} until status !== "running". Starts at 1s, backs off to 3s.
 * Cleans up cleanly on unmount or when jobId changes.
 */
export function useJobPolling(jobId: string | null) {
  const [job, setJob] = useState<Job | null>(null)
  const [error, setError] = useState<string | null>(null)
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (!jobId) {
      setJob(null)
      setError(null)
      return
    }

    let cancelled = false
    let delay = 1000

    const tick = async () => {
      try {
        const j = await fetchJob(jobId)
        if (cancelled) return
        setJob(j)
        if (j.status === "running") {
          delay = Math.min(delay * 1.3, 3000)
          timer.current = window.setTimeout(tick, delay)
        }
      } catch (e: unknown) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Polling failed")
      }
    }

    tick()
    return () => {
      cancelled = true
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [jobId])

  return { job, error }
}

export { API_URL }
