"""
Media preparation: strip audio from video (to bypass TRIBE's audio branch
cleanly when not useful), or convert a still image to a short video so the
model can process it.

Both return a path to a temp file — caller is responsible for cleanup, or
just let the container tmpfs wipe on shutdown.
"""
from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

import cv2


def strip_audio(video_path: str | Path) -> str:
    """Copy video stream, drop audio. Fast — no re-encode."""
    out = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    out.close()
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(video_path), "-c:v", "copy", "-an", out.name],
        check=True,
        capture_output=True,
    )
    return out.name


def image_to_video(image_path: str | Path, duration: int = 3, fps: int = 10) -> str:
    """Still image → silent MP4 of `duration` seconds. TRIBE runs on video."""
    img = cv2.imread(str(image_path))
    if img is None:
        raise ValueError(f"could not read image: {image_path}")

    h, w = img.shape[:2]
    # H.264 needs even dimensions
    if w % 2:
        w -= 1
    if h % 2:
        h -= 1
    img = img[:h, :w]

    out = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    out.close()

    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(out.name, fourcc, fps, (w, h))
    for _ in range(duration * fps):
        writer.write(img)
    writer.release()
    return out.name
