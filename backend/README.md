# NeuroLab backend (Modal)

GPU-backed inference service for TRIBE v2 A/B testing. One A10G container stays warm; FastAPI ASGI app fronts it with a job-queue pattern.

## One-time setup

```bash
# 1. Install Modal CLI + authenticate
pip install modal
modal token new

# 2. Store your HuggingFace token as a Modal secret
#    (TRIBE pulls gated Llama-3.2 — you must have requested access already)
modal secret create huggingface-secret \
  HUGGINGFACE_ACCESS_TOKEN=hf_your_token_here
```

## Deploy

```bash
# From this directory:
modal deploy modal_app.py
```

Modal prints a URL like `https://your-workspace--neurolab-ab-fastapi-app.modal.run`. That's your API root. Endpoints:

- `GET /health` — sanity check
- `POST /analyze` — multipart: `ad_a`, `ad_b`, `kind=video|image` → returns `{job_id}`
- `GET /jobs/{job_id}` — poll: returns `{status: "running"|"done"|"failed", ad_a, ad_b}`

## Dev loop (hot-reload)

```bash
modal serve modal_app.py
```

Edits to `modal_app.py`, `metrics.py`, `media_prep.py` hot-reload. First run takes 3-6 min (image build + model download); subsequent runs boot in ~15s thanks to the Volume cache and `min_containers=1`.

## Cost ballpark

- A10G at ~$1.10/hr × warm container × whatever idle you configure.
- With `min_containers=1` and `scaledown_window=600`, you pay for one A10G ~24/7 = **~$26/day**. If that's too hot for a demo, drop to `min_containers=0` — you'll eat 30-60s cold starts on first request of the day.

## Smoke test

```bash
# Swap in your deployed URL
export API=https://your-workspace--neurolab-ab-fastapi-app.modal.run

curl $API/health

curl -X POST $API/analyze \
  -F "ad_a=@sample_a.mp4" \
  -F "ad_b=@sample_b.mp4" \
  -F "kind=video"
# → {"job_id": "abc123...", "status": "running"}

curl $API/jobs/abc123...
```

## Files

- `modal_app.py` — Modal app, `TribeService` GPU class, FastAPI routes
- `metrics.py` — `voxels_to_metrics` with cached region masks
- `media_prep.py` — `strip_audio`, `image_to_video` helpers
