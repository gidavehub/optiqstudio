"""MuseTalk (Tencent, MIT) — near-real-time audio-driven lip sync.

Repo: https://github.com/TMElyralab/MuseTalk  (code + weights MIT, commercial OK)

Runs the repo's normal inference script (v1.5). Weights are baked into the image
under /opt/MuseTalk/models. MuseTalk accepts a still image as `video_path`.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import yaml

MUSETALK_HOME = Path("/opt/MuseTalk")


def generate(
    face_image: Path,
    audio_wav: Path,
    out_mp4: Path,
    weights_dir: str,
    device: str = "cuda",
) -> Path:
    out_mp4.parent.mkdir(parents=True, exist_ok=True)
    result_dir = out_mp4.parent / "musetalk_out"

    cfg_path = out_mp4.parent / "musetalk_task.yaml"
    cfg_path.write_text(
        yaml.safe_dump({"task_0": {"video_path": str(face_image), "audio_path": str(audio_wav)}})
    )

    cmd = [
        sys.executable, "-m", "scripts.inference",
        "--inference_config", str(cfg_path),
        "--result_dir", str(result_dir),
        "--unet_model_path", "./models/musetalkV15/unet.pth",
        "--unet_config", "./models/musetalkV15/musetalk.json",
        "--version", "v15",
    ]
    subprocess.run(cmd, cwd=str(MUSETALK_HOME), check=True)

    produced = sorted(result_dir.rglob("*.mp4"), key=lambda p: p.stat().st_mtime)
    if not produced:
        raise RuntimeError("MuseTalk produced no output mp4")
    produced[-1].replace(out_mp4)
    return out_mp4
