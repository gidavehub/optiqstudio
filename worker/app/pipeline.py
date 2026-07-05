"""Orchestrates the two-stage pipeline: TTS -> lip sync."""
from __future__ import annotations

from pathlib import Path

from .config import Config
from .models import tts_chatterbox
from .storage import Store, Timer


def run(cfg: Config, store: Store, job_id: str, job: dict) -> str:
    """Execute the full pipeline for one job. Returns the output object path."""
    work = Path(cfg.work_dir) / job_id
    timer = Timer()

    face = store.download(job["faceImagePath"], work / "face.png")
    voice = store.download(job["voiceSamplePath"], work / "voice.wav")

    # Stage 1 — voice cloning (0 -> 40% of progress bar)
    audio = work / "audio.wav"
    with timer("tts"):
        tts_chatterbox.synthesize(
            text=job["text"],
            voice_sample=voice,
            out_wav=audio,
            device=cfg.device,
            on_progress=lambda p: store.set_progress(job_id, 0.4 * p),
        )

    # Stage 2 — lip sync (40% -> 95%); backend chosen per job/image
    store.set_progress(job_id, 0.4)
    out = work / "out.mp4"
    with timer("lipsync"):
        if cfg.backend == "latentsync":
            from .models import lipsync_latentsync as backend
        else:
            from .models import lipsync_musetalk as backend
        backend.generate(
            face_image=face, audio_wav=audio, out_mp4=out,
            weights_dir=cfg.weights_dir, device=cfg.device,
        )

    store.set_progress(job_id, 0.95)
    object_path = job.get("outputPath") or f"outputs/{job_id}.mp4"
    with timer("upload"):
        store.upload(out, object_path, content_type="video/mp4")

    store.update_job(job_id, timings=timer.timings)
    return object_path
