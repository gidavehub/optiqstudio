"""LatentSync 1.6 (ByteDance, Apache-2.0) — diffusion, highest-quality lip sync.

Repo: https://github.com/bytedance/LatentSync

LatentSync drives from a *video*, so a single face photo is looped for the audio's
duration first. Weights are baked into the image under /opt/LatentSync/checkpoints.
Needs ~18GB VRAM (A10G). `--enable_deepcache` speeds diffusion; 20 steps /
guidance 1.5 are the upstream defaults.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

LATENTSYNC_HOME = Path("/opt/LatentSync")


def _still_to_video(face_image: Path, audio_wav: Path, out_video: Path) -> Path:
    dur = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", str(audio_wav)],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
    subprocess.run(
        ["ffmpeg", "-y", "-loop", "1", "-i", str(face_image), "-t", dur,
         "-r", "25", "-pix_fmt", "yuv420p", str(out_video)],
        check=True,
    )
    return out_video


def generate(
    face_image: Path,
    audio_wav: Path,
    out_mp4: Path,
    weights_dir: str,
    device: str = "cuda",
) -> Path:
    out_mp4.parent.mkdir(parents=True, exist_ok=True)
    driving = out_mp4.parent / "driving.mp4"
    _still_to_video(face_image, audio_wav, driving)

    cmd = [
        sys.executable, "-m", "scripts.inference",
        "--unet_config_path", "configs/unet/stage2_512.yaml",
        "--inference_ckpt_path", "checkpoints/latentsync_unet.pt",
        "--inference_steps", "20",
        "--guidance_scale", "1.5",
        "--enable_deepcache",
        "--video_path", str(driving),
        "--audio_path", str(audio_wav),
        "--video_out_path", str(out_mp4),
    ]
    subprocess.run(cmd, cwd=str(LATENTSYNC_HOME), check=True)
    return out_mp4
