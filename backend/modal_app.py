"""
NeuroLab — Modal backend.

Architecture:

  React client ──POST /analyze──►  FastAPI (Modal, CPU, always-on)
                                        │ .spawn() × 2
                                        ▼
                                 TribeService (Modal, A10G GPU)
                                        │  extractors loaded once,
                                        │  container kept warm
                                        ▼
                                  metrics dict
                                        │
  React client ──GET /jobs/{id}──►  poll status until done

Deploy:
    modal secret create huggingface-secret HUGGINGFACE_ACCESS_TOKEN=hf_xxx
    modal deploy modal_app.py

Dev (hot-reload):
    modal serve modal_app.py
"""
import os
import tempfile
import time
import uuid
from pathlib import Path
from typing import Literal

import modal

# ══════════════════════════════════════════════════════════════════════
#  App + Image + Storage
# ══════════════════════════════════════════════════════════════════════

app = modal.App("neurolab-ab")

# Persistent cache for HuggingFace weights (TRIBE model, LLaMA, V-JEPA2, etc.)
# First build downloads ~1GB; subsequent containers boot from the Volume.
hf_cache = modal.Volume.from_name("neurolab-hf-cache", create_if_missing=True)
TRIBE_CACHE = "/cache/tribe"
HF_HOME = "/cache/hf"

# Shared state for job tracking (job_id → {call_id_a, call_id_b, filenames}).
# Modal Dict is durable across containers — FastAPI container writes,
# any poller can read.
jobs_dict = modal.Dict.from_name("neurolab-jobs", create_if_missing=True)

gpu_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "git")
    .pip_install(
        # TRIBE and its transitive deps (torch, transformers, whisperx, etc.)
        "tribev2[plotting] @ git+https://github.com/facebookresearch/tribev2.git",
        "nilearn",
        "opencv-python-headless",
    )
    # TRIBE pins an older numpy; force the version their notebook needs.
    .pip_install("numpy==2.2.6", force_build=False)
    .env({
        "HF_HOME": HF_HOME,
        "HF_HUB_CACHE": HF_HOME,
        "TRANSFORMERS_CACHE": HF_HOME,
    })
    # Include our sibling modules in the container
    .add_local_python_source("metrics", "media_prep")
)

web_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "fastapi[standard]==0.115.0",
        "python-multipart==0.0.9",
        "numpy",
        "nilearn",
        "opencv-python-headless",
    )
)


# ══════════════════════════════════════════════════════════════════════
#  Inference service — one class, stays warm, holds the model
# ══════════════════════════════════════════════════════════════════════

@app.cls(
    image=gpu_image,
    gpu="A10G",                               # 24GB VRAM, comfy for TRIBE
    volumes={"/cache": hf_cache},
    secrets=[modal.Secret.from_name("huggingface-secret")],
    min_containers=1,                         # TEMP: 0 while debugging — flip to 1 once stable
    scaledown_window=600,                     # idle 10 min before shutdown
    timeout=600,                              # 10 min per inference max
    startup_timeout=1800,                     # 30 min for first-ever HF download + warm-up
)
class TribeService:
    """
    TRIBE v2 inference, with extractors pre-warmed on GPU.

    Your notebook had a subtle perf bug: TRIBE lazy-loads feature extractors
    on the first predict() call and leaves several on CPU. We fix that here
    by doing a real dummy inference in @modal.enter(), then forcing every
    extractor's underlying model to .cuda(). Saves ~20-40s per subsequent call.
    """

    @modal.enter()
    def warm_up(self):
        import torch
        from tribev2.demo_utils import TribeModel

        # HF token from the secret; TRIBE's Llama-3.2 dep needs gated access.
        token = os.environ.get("HUGGINGFACE_ACCESS_TOKEN")
        if token:
            from huggingface_hub import login
            login(token=token, add_to_git_credential=False)

        Path(TRIBE_CACHE).mkdir(parents=True, exist_ok=True)
        print("[warm_up] loading TRIBE v2...")
        self.model = TribeModel.from_pretrained(
            "facebook/tribev2",
            cache_folder=Path(TRIBE_CACHE),
        )
        print("[warm_up] TRIBE loaded.")

        # Trigger lazy extractor init with a SYNTHETIC 3s gray video.
        # Sintel trailer (52s) runs on CPU during lazy-load (~11 min) and
        # blows past Modal's startup_timeout. 3s clip = ~30s warm-up.
        import cv2
        import numpy as np
        dummy_path = Path(TRIBE_CACHE) / "dummy_tiny.mp4"
        if not dummy_path.exists():
            h, w, fps, secs = 240, 320, 10, 3
            writer = cv2.VideoWriter(
                str(dummy_path),
                cv2.VideoWriter_fourcc(*"mp4v"),
                fps, (w, h),
            )
            frame = np.full((h, w, 3), 128, dtype=np.uint8)
            for _ in range(fps * secs):
                writer.write(frame)
            writer.release()

        print("[warm_up] triggering extractor lazy-load...")
        df = self.model.get_events_dataframe(video_path=str(dummy_path))
        _preds, _segments = self.model.predict(events=df)

        # Force every extractor onto GPU (TRIBE leaves some on CPU by default)
        if hasattr(self.model, "data") and hasattr(self.model.data, "extractors"):
            for name, ex in self.model.data.extractors.items():
                if hasattr(ex, "model") and ex.model is not None:
                    try:
                        ex.model.cuda()
                        ex.model.eval()
                        dev = next(ex.model.parameters()).device
                        print(f"[warm_up]   {name} → {dev}")
                    except Exception as e:
                        print(f"[warm_up]   {name} stayed on CPU: {e}")

        torch.cuda.empty_cache()
        print("[warm_up] ready.")

    @modal.method()
    def analyze(
        self,
        media_bytes: bytes,
        kind: Literal["video", "image"] = "video",
        original_filename: str = "ad",
    ) -> dict:
        """Run TRIBE on one ad, return metrics dict."""
        import numpy as np
        import torch

        from media_prep import image_to_video, strip_audio
        from metrics import voxels_to_metrics

        torch.cuda.empty_cache()
        t0 = time.perf_counter()

        # Write upload to tmpfs. Pick extension off filename so cv2/ffmpeg
        # probe correctly.
        suffix = Path(original_filename).suffix or (".mp4" if kind == "video" else ".jpg")
        tmp_in = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
        tmp_in.write(media_bytes)
        tmp_in.close()

        try:
            if kind == "image":
                video_path = image_to_video(tmp_in.name)
            else:
                # Audio is stripped — your pipeline doesn't use the audio branch
                # meaningfully for short ads, and it's where most crashes come from.
                video_path = strip_audio(tmp_in.name)

            df = self.model.get_events_dataframe(video_path=video_path)
            preds, _segments = self.model.predict(events=df)
            preds_np = preds.cpu().numpy() if hasattr(preds, "cpu") else np.asarray(preds)

            scores = voxels_to_metrics(preds_np)
            elapsed = time.perf_counter() - t0
            peak_vram = torch.cuda.max_memory_allocated() / 1e9

            return {
                "filename": original_filename,
                "metrics": scores,
                "timing": {
                    "inference_sec": round(elapsed, 2),
                    "peak_vram_gb": round(peak_vram, 2),
                    "n_timesteps": int(preds_np.shape[0]),
                },
            }
        finally:
            try:
                os.unlink(tmp_in.name)
            except OSError:
                pass


# ══════════════════════════════════════════════════════════════════════
#  Web endpoints — FastAPI, CPU only, cheap
# ══════════════════════════════════════════════════════════════════════

@app.function(
    image=web_image,
    min_containers=1,
    scaledown_window=300,
)
@modal.concurrent(max_inputs=20)              # plenty for polling
@modal.asgi_app()
def fastapi_app():
    from fastapi import FastAPI, File, Form, HTTPException, UploadFile
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import JSONResponse

    api = FastAPI(title="NeuroLab A/B", version="1.0.0")
    api.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],                  # shareable demo — wide open
        allow_methods=["*"],
        allow_headers=["*"],
    )

    MAX_VIDEO_MB = 100
    MAX_IMAGE_MB = 15

    @api.get("/health")
    def health():
        return {"ok": True, "service": "neurolab-ab"}

    @api.post("/analyze")
    async def analyze(
        ad_a: UploadFile = File(...),
        ad_b: UploadFile = File(...),
        kind: str = Form("video"),            # "video" | "image"
    ):
        if kind not in ("video", "image"):
            raise HTTPException(400, "kind must be 'video' or 'image'")

        limit_mb = MAX_IMAGE_MB if kind == "image" else MAX_VIDEO_MB
        limit_bytes = limit_mb * 1024 * 1024

        bytes_a = await ad_a.read()
        bytes_b = await ad_b.read()

        for label, data in (("ad_a", bytes_a), ("ad_b", bytes_b)):
            if len(data) > limit_bytes:
                raise HTTPException(413, f"{label} exceeds {limit_mb}MB")
            if len(data) < 1024:
                raise HTTPException(400, f"{label} is suspiciously small")

        # Fire-and-forget: returns a FunctionCall handle we can poll later.
        svc = TribeService()
        call_a = svc.analyze.spawn(bytes_a, kind, ad_a.filename or "ad_a")
        call_b = svc.analyze.spawn(bytes_b, kind, ad_b.filename or "ad_b")

        job_id = uuid.uuid4().hex[:12]
        jobs_dict[job_id] = {
            "call_a": call_a.object_id,
            "call_b": call_b.object_id,
            "filename_a": ad_a.filename,
            "filename_b": ad_b.filename,
            "kind": kind,
            "created_at": time.time(),
        }

        return {"job_id": job_id, "status": "running"}

    @api.get("/jobs/{job_id}")
    def get_job(job_id: str):
        job = jobs_dict.get(job_id)
        if not job:
            raise HTTPException(404, "job not found")

        def poll(call_id: str):
            try:
                fc = modal.FunctionCall.from_id(call_id)
                return fc.get(timeout=0)      # raises TimeoutError if pending
            except TimeoutError:
                return None
            except Exception as e:            # function raised
                import traceback
                print(f"[poll] call_id={call_id}:", traceback.format_exc())
                return {"__error__": f"{type(e).__name__}: {e}"}

        result_a = poll(job["call_a"])
        result_b = poll(job["call_b"])

        def state(r):
            if r is None:
                return "running"
            if isinstance(r, dict) and "__error__" in r:
                return "failed"
            return "done"

        status_a, status_b = state(result_a), state(result_b)

        if status_a == "failed" or status_b == "failed":
            overall = "failed"
        elif status_a == "done" and status_b == "done":
            overall = "done"
        else:
            overall = "running"

        payload = {
            "job_id": job_id,
            "status": overall,
            "kind": job["kind"],
            "created_at": job["created_at"],
            "ad_a": {
                "filename": job["filename_a"],
                "status": status_a,
                "result": result_a if status_a == "done" else None,
                "error": result_a.get("__error__") if status_a == "failed" else None,
            },
            "ad_b": {
                "filename": job["filename_b"],
                "status": status_b,
                "result": result_b if status_b == "done" else None,
                "error": result_b.get("__error__") if status_b == "failed" else None,
            },
        }
        return JSONResponse(payload)

    return api