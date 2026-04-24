"""
Media preparation: strip audio from video, convert a still image to video,
or render text + TTS voiceover into a video so TRIBE can process pure text
ads (headlines / ad copy).

All functions return a path to a temp file — caller is responsible for
cleanup, or just let the container tmpfs wipe on shutdown.
"""
import subprocess
import tempfile
import textwrap
from pathlib import Path

import cv2
import numpy as np


def strip_audio(video_path):
    """Copy video stream, drop audio. Fast — no re-encode."""
    out = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    out.close()
    subprocess.run(
        ["ffmpeg", "-y", "-i", str(video_path), "-c:v", "copy", "-an", out.name],
        check=True,
        capture_output=True,
    )
    return out.name


def image_to_video(image_path, duration=3, fps=10):
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


def text_to_video(text, fps=10, max_seconds=12):
    """
    Render `text` as a clean centered card, synthesize espeak-ng voiceover,
    mux into one MP4. Duration scales with text length (speaking rate ~2.5
    words/sec + 1s padding), capped at `max_seconds`.

    Why this works for TRIBE:
    - Video branch (V-JEPA2) sees the rendered text → visual-word-form area
    - Audio branch (Wav2Vec-BERT) encodes the TTS waveform
    - Whisper transcribes the voiceover → Llama-3.2 text extractor gets tokens
    - All three feed the cortical predictor → strong language-region signal
    """
    if not text or not text.strip():
        raise ValueError("text is empty")
    text = text.strip()

    # ── 1. Estimate duration from word count
    words = len(text.split())
    duration = int(max(3, min(max_seconds, round(words / 2.5) + 2)))

    # ── 2. Render a text card (1280x720, cream bg, dark ink, centered)
    w, h = 1280, 720
    bg_color = (245, 250, 250)   # BGR cream
    fg_color = (26, 26, 26)       # BGR near-black
    img = np.full((h, w, 3), bg_color, dtype=np.uint8)

    font = cv2.FONT_HERSHEY_DUPLEX
    # Pick wrap width and font scale based on text length
    if words <= 8:
        scale, thickness, wrap = 2.4, 3, 22
    elif words <= 20:
        scale, thickness, wrap = 1.8, 2, 30
    else:
        scale, thickness, wrap = 1.3, 2, 42

    lines = textwrap.wrap(text, width=wrap)
    line_h = int(cv2.getTextSize("Xg", font, scale, thickness)[0][1] * 1.8)
    total_h = line_h * len(lines)
    y0 = (h - total_h) // 2 + line_h

    for i, line in enumerate(lines):
        (tw, _), _ = cv2.getTextSize(line, font, scale, thickness)
        x = (w - tw) // 2
        y = y0 + i * line_h
        cv2.putText(img, line, (x, y), font, scale, fg_color, thickness, cv2.LINE_AA)

    # ── 3. Write silent video
    silent = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    silent.close()
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    writer = cv2.VideoWriter(silent.name, fourcc, fps, (w, h))
    for _ in range(duration * fps):
        writer.write(img)
    writer.release()

    # ── 4. Synthesize TTS with espeak-ng (fast, offline, ~10MB package)
    #        -s = speed WPM, -p = pitch, -w = output WAV
    audio = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    audio.close()
    try:
        subprocess.run(
            ["espeak-ng", "-s", "150", "-p", "50", "-w", audio.name, text],
            check=True,
            capture_output=True,
            timeout=30,
        )
    except (subprocess.CalledProcessError, FileNotFoundError) as e:
        # Fallback: return silent video if espeak-ng is missing. Language
        # signal will be weaker but video branch still activates on text.
        print(f"[text_to_video] espeak-ng failed, falling back to silent: {e}")
        return silent.name

    # ── 5. Mux video + audio (re-encode audio to AAC, copy video stream)
    out = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
    out.close()
    subprocess.run(
        [
            "ffmpeg", "-y",
            "-i", silent.name,
            "-i", audio.name,
            "-c:v", "copy",
            "-c:a", "aac",
            "-shortest",          # trim to the shorter stream (usually audio)
            out.name,
        ],
        check=True,
        capture_output=True,
    )

    # Clean up intermediates
    for p in (silent.name, audio.name):
        try:
            Path(p).unlink()
        except OSError:
            pass

    return out.name