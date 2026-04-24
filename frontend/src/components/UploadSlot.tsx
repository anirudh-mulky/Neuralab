import { useCallback, useMemo } from "react"
import { useDropzone } from "react-dropzone"
import type { Accept } from "react-dropzone"

type Props = {
  label: string
  kind: "video" | "image"
  file: File | null
  onChange: (f: File | null) => void
  disabled?: boolean
}

export function UploadSlot({ label, kind, file, onChange, disabled }: Props) {
  const accept = useMemo<Accept>(() => {
    const config: Accept = {}
    if (kind === "video") {
      config["video/*"] = [".mp4", ".mov", ".webm", ".mkv"]
    } else {
      config["image/*"] = [".jpg", ".jpeg", ".png", ".webp"]
    }
    return config
  }, [kind])

  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted[0]) onChange(accepted[0])
    },
    [onChange],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxFiles: 1,
    disabled,
  })

  const previewUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  )

  return (
    <div className="flex flex-col">
      <label className="text-[11px] uppercase tracking-[0.12em] text-txt-tertiary mb-2 mono">
        {label}
      </label>

      {!file ? (
        <div
          {...getRootProps()}
          className={[
            "relative min-h-[160px] lg:min-h-0 lg:aspect-video rounded-xl cursor-pointer transition-colors",
            "border border-dashed flex items-center justify-center",
            isDragActive
              ? "border-purple-600 bg-purple-50"
              : "border-border bg-bg-card hover:border-purple-400 hover:bg-purple-50/40",
            disabled ? "opacity-50 pointer-events-none" : "",
          ].join(" ")}
        >
          <input {...getInputProps()} className="hidden" />
          <div className="text-center px-6">
            <div className="text-sm text-txt-secondary">
              {isDragActive ? "Drop it" : `Drop ${kind} or click to browse`}
            </div>
            <div className="text-[11px] text-txt-tertiary mt-1 mono">
              {kind === "video" ? "mp4, mov, webm · up to 100MB" : "jpg, png, webp · up to 15MB"}
            </div>
          </div>
        </div>
      ) : (
        <div className="relative aspect-video rounded-xl overflow-hidden bg-bg-muted border border-border">
          {kind === "video" && previewUrl ? (
            <video
              src={previewUrl}
              className="absolute inset-0 w-full h-full object-cover"
              controls
              muted
            />
          ) : previewUrl ? (
            <img
              src={previewUrl}
              className="absolute inset-0 w-full h-full object-cover"
              alt={file.name}
            />
          ) : null}

          {!disabled && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onChange(null)
              }}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white text-sm hover:bg-black/80 transition-colors"
              aria-label="Remove"
            >
              ×
            </button>
          )}
        </div>
      )}

      {file && (
        <div className="mt-2 text-[11px] text-txt-tertiary mono truncate">
          {file.name} · {(file.size / 1024 / 1024).toFixed(1)}MB
        </div>
      )}
    </div>
  )
}
