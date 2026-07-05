"""Fetch model weights into $WEIGHTS_DIR.

Run at image-build time (baked weights) or once into the GCS weights/ prefix for
FUSE-mounting — the choice is made after benchmarking cold-start cost. Chatterbox
pulls its own weights from Hugging Face on first use (cached under HF_HOME).

Finalized during the model-sourcing step with exact HF repo ids + revisions.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

WEIGHTS = Path(os.environ.get("WEIGHTS_DIR", "/weights"))


def fetch_musetalk() -> None:
    # MuseTalk weights (musetalk.json + pytorch_model.bin), sd-vae-ft-mse,
    # whisper, dwpose, face-parse-bisent — via huggingface_hub snapshot_download.
    raise NotImplementedError("pin MuseTalk weight repos during sourcing step")


def fetch_latentsync() -> None:
    # LatentSync: latentsync_unet.pt + whisper tiny + auxiliary models,
    # via huggingface_hub snapshot_download of ByteDance/LatentSync.
    raise NotImplementedError("pin LatentSync weight repos during sourcing step")


if __name__ == "__main__":
    backend = (sys.argv[1] if len(sys.argv) > 1 else os.environ.get("LIPSYNC_BACKEND", "")).lower()
    WEIGHTS.mkdir(parents=True, exist_ok=True)
    {"musetalk": fetch_musetalk, "latentsync": fetch_latentsync}[backend]()
