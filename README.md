# NeuroLab A/B — Neural A/B testing for ads

End-to-end product: **React** frontend + **Modal GPU** backend running Meta FAIR's **TRIBE v2** to predict fMRI brain responses to video/image ads, then scoring them on four marketing dimensions: **visual lock, attention, memory, and emotional pull**.

```
React (Vercel)  ──HTTPS──►  FastAPI (Modal CPU, always-on)
                                 │ .spawn() × 2
                                 ▼
                         TribeService (Modal A10G GPU, warm)
                                 │
                                 ▼
                           metrics dict
```

## Why this exists

You were running TRIBE on Colab + Gradio and hitting three walls at once: OOM crashes, session disconnects, and slow inference. The fix isn't a React rewrite — it's separating the **runtime** (which needs a persistent GPU backend) from the **UI** (which becomes trivially static once the backend is stable).

## Repo layout

```
neurolab/
├── backend/           ← Modal app — GPU inference + FastAPI
│   ├── modal_app.py   ← TribeService class + ASGI endpoints
│   ├── metrics.py     ← voxels_to_metrics (cached region masks)
│   ├── media_prep.py  ← strip_audio, image_to_video
│   └── README.md      ← deploy instructions
│
├── frontend/          ← React + Vite + TS + Tailwind
│   ├── src/
│   │   ├── App.tsx
│   │   ├── lib/{api,types}.ts
│   │   └── components/{UploadSlot,MetricCard,BrainMap,ResultsDashboard,StateCard}.tsx
│   └── package.json
│
└── README.md          ← you are here
```

## 5-hour deploy plan

### Hour 1 — Modal backend up

```bash
cd backend
pip install modal
modal token new
modal secret create huggingface-secret HUGGINGFACE_ACCESS_TOKEN=hf_xxx
modal deploy modal_app.py
# Note the printed URL — that's your API root.
```

First deploy builds the image (3-6 min) and downloads TRIBE weights into the Volume on first container boot (~2 min). Subsequent deploys use the cached Volume. `min_containers=1` means one A10G stays warm — no cold starts after that.

### Hour 2 — Smoke test the API

```bash
export API=https://your-workspace--neurolab-ab-fastapi-app.modal.run
curl $API/health
curl -X POST $API/analyze -F "ad_a=@a.mp4" -F "ad_b=@b.mp4" -F "kind=video"
# → {"job_id":"...", "status":"running"}
curl $API/jobs/$JOB_ID  # poll until status=done
```

If `/analyze` returns 200 and `/jobs/{id}` eventually returns `status: done`, backend is solid.

### Hour 3 — Frontend local

```bash
cd ../frontend
npm install
cp .env.example .env
# Edit .env — set VITE_API_URL to the Modal URL from step 1
npm run dev
```

Open `http://localhost:5173`, drop two MP4s, click **Run neural analysis**.

### Hour 4 — Deploy frontend to Vercel

```bash
npm i -g vercel
vercel                         # first time — follow prompts
# Set VITE_API_URL in the Vercel dashboard under Settings → Environment Variables
vercel --prod
```

Your client-shareable URL: `https://neurolab-xxx.vercel.app`. That's what you send to clients.

### Hour 5 — Polish and QA

- Run real ads through it end-to-end twice
- Check error paths: upload a 200MB file (should 413), upload only one file (button disabled), kill network mid-poll (should show `Connection lost`)
- Tune `scaledown_window` on Modal if you want cheaper idle: set to `60` to spin down fast when idle
- Add a subtle loading phase message if you want — e.g., swap `phaseText()` for something cuter

## Cost

At default `min_containers=1`, A10G at ~$1.10/hr ≈ **$26/day kept warm**. For a few-client demo this is reasonable. To cut costs on quiet days, set `min_containers=0` — you eat a 30-60s cold start on the first request of the day but pay ~$0 idle.

FastAPI container is CPU-only and effectively free.

## What's different from your Colab version

| | Colab + Gradio | This stack |
|---|---|---|
| GPU | T4 16GB, shared, preempted | A10G 24GB, dedicated, warm |
| Session | Dies after ~90 min idle | Auto-scaling, no disconnects |
| Extractors | Lazy-loaded per request | Pre-warmed on container boot |
| Region masks | Rebuilt every call | Cached at module import |
| Concurrency | Serialized in one process | `.spawn()` × N in parallel |
| Shareability | ngrok URL that rotates | Stable HTTPS custom domain |
| Frontend | Gradio (fine but locked in) | React (full control, deployable anywhere) |

## Gotchas

**Llama-3.2 gating.** TRIBE uses Llama-3.2 as its text extractor. You must have accepted Meta's license on HuggingFace for `meta-llama/Llama-3.2-1B` (or whichever variant TRIBE pulls) on the same HF account whose token is in the `huggingface-secret`.

**Audio is stripped.** The `strip_audio` step removes sound before inference. Short ads often have music/VO that TRIBE's speech branch (via WhisperX) either misreads or crashes on. If you care about auditory/language metrics, remove `strip_audio` and pass the video raw — but test carefully.

**First deploy is slow.** The TRIBE install from git pulls a lot of torch/transformers extras. Subsequent rebuilds use Docker layer caching. If you edit only `metrics.py` or `media_prep.py`, the image rebuild is fast because `pip_install` is cached earlier in the layer chain.

## Extension ideas (post-5-hours)

- **Persist jobs.** Swap the in-memory `modal.Dict` for Postgres (Neon free tier) so you can show a history and permalink results.
- **Multi-variant.** Accept N ads, run a mini-tournament, produce a leaderboard. `.spawn()` scales trivially.
- **Region drill-down.** Let users click a metric and see the raw fMRI heatmap on a 3D brain (you already have `nilearn` + `PlotBrain` in the deps — return a PNG alongside the metrics).
- **Auth.** If this graduates past shareable-link: add Clerk, gate `/analyze`, bill per inference.
