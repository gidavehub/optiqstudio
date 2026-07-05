"""Modal deployment for the Optiq avatar pipeline.

GCP GPU quota is account-age locked, so renders run on Modal (scale-to-zero,
$30/mo free credit). Storage + Firestore stay on GCP (`davelabs-tools`).

Three ISOLATED images/functions so no two models ever share a dependency tree:
  * tts_fn            — Chatterbox (MIT), newer torch          → cloned-voice wav
  * lipsync_musetalk  — MuseTalk (MIT), torch 2.0.1 + mmlab    → mp4  (fast, L4)
  * lipsync_latentsync— LatentSync 1.6 (Apache-2.0), diffusion → mp4  (best, A10G)

A cheap CPU `render` coordinator chains TTS -> lip-sync via .remote(); the public
`submit` endpoint (token-guarded) spawns it. Reuses worker/app/* model adapters.

GCP creds + submit token come from the `optiq-gcp` Modal secret
(GCP_SA_B64 = base64 SA key, OPTIQ_SUBMIT_TOKEN = shared token).

Deploy (run from the worker/ dir so `app` is importable):
    python -m modal deploy modal_app.py
"""
from __future__ import annotations

import os

import modal

app = modal.App("optiq-avatar")

# HF cache + any lazily-fetched weights persist here across cold starts.
weights = modal.Volume.from_name("optiq-weights", create_if_missing=True)
gcp_secret = modal.Secret.from_name("optiq-gcp")

WEIGHTS_DIR = "/weights"
VOLUMES = {WEIGHTS_DIR: weights}


GCLOUD = ("google-cloud-storage>=2.16", "google-cloud-firestore>=2.16")
# MuseTalk's mediapipe pins protobuf<4, but the modern Google Cloud libs pull
# protobuf 7. These older pins are compatible with protobuf 3.20.x, so the two
# coexist in the MuseTalk image.
GCLOUD_PB3 = ("google-cloud-storage==2.14.0", "google-cloud-firestore==2.13.1")


def _shared(img: modal.Image, gcloud: tuple[str, ...] = GCLOUD) -> modal.Image:
    """GCP clients + env + our worker/app source, added last on every image."""
    return (
        img.pip_install(*gcloud)
        .env({"WEIGHTS_DIR": WEIGHTS_DIR, "HF_HOME": f"{WEIGHTS_DIR}/hf",
              "BUCKET": "davelabs-tools", "FIRESTORE_COLLECTION": "generations"})
        .add_local_python_source("app")
    )


# --- Chatterbox TTS image --------------------------------------------------
tts_image = _shared(
    modal.Image.debian_slim(python_version="3.10")
    .apt_install("ffmpeg", "git")
    .pip_install("chatterbox-tts>=0.1.1", "torchaudio")
)

# --- MuseTalk image (torch 2.0.1 + mmlab, weights baked at build) ----------
musetalk_image = _shared(
    modal.Image.debian_slim(python_version="3.10")
    .apt_install("ffmpeg", "git", "libgl1", "libglib2.0-0", "build-essential", "curl")
    .pip_install(
        "torch==2.0.1", "torchvision==0.15.2", "torchaudio==2.0.2",
        extra_index_url="https://download.pytorch.org/whl/cu118",
    )
    .run_commands("git clone --depth 1 https://github.com/TMElyralab/MuseTalk /opt/MuseTalk")
    .run_commands("cd /opt/MuseTalk && pip install -r requirements.txt")
    .pip_install("PyYAML>=6.0", "gdown", "huggingface_hub", "openmim")
    .run_commands(
        "mim install mmengine",
        "mim install mmcv==2.0.1",
        "mim install mmdet==3.1.0",
        "mim install mmpose==1.1.0",
    )
    .run_commands(
        "mkdir -p /opt/MuseTalk/models/face-parse-bisent",
        "huggingface-cli download TMElyralab/MuseTalk --local-dir /opt/MuseTalk/models "
        "--include 'musetalkV15/musetalk.json' 'musetalkV15/unet.pth'",
        "huggingface-cli download stabilityai/sd-vae-ft-mse --local-dir /opt/MuseTalk/models/sd-vae "
        "--include 'config.json' 'diffusion_pytorch_model.bin'",
        "huggingface-cli download openai/whisper-tiny --local-dir /opt/MuseTalk/models/whisper "
        "--include 'config.json' 'pytorch_model.bin' 'preprocessor_config.json'",
        "huggingface-cli download yzd-v/DWPose --local-dir /opt/MuseTalk/models/dwpose "
        "--include 'dw-ll_ucoco_384.pth'",
        "huggingface-cli download ByteDance/LatentSync --local-dir /opt/MuseTalk/models/syncnet "
        "--include 'latentsync_syncnet.pt'",
        "gdown 154JgKpzCPW82qINcVieuPH3fZ2e0P812 "
        "-O /opt/MuseTalk/models/face-parse-bisent/79999_iter.pth",
        "curl -L https://download.pytorch.org/models/resnet18-5c106cde.pth "
        "-o /opt/MuseTalk/models/face-parse-bisent/resnet18-5c106cde.pth",
    )
    .env({"LIPSYNC_BACKEND": "musetalk"}),
    gcloud=GCLOUD_PB3,
)

# --- LatentSync image (Apache-2.0, weights baked at build) -----------------
latentsync_image = _shared(
    modal.Image.debian_slim(python_version="3.10")
    .apt_install("ffmpeg", "git", "libgl1", "build-essential")
    .run_commands("git clone --depth 1 https://github.com/bytedance/LatentSync /opt/LatentSync")
    .run_commands("cd /opt/LatentSync && pip install -r requirements.txt")
    .pip_install("huggingface_hub")
    .run_commands(
        "huggingface-cli download ByteDance/LatentSync-1.6 whisper/tiny.pt "
        "--local-dir /opt/LatentSync/checkpoints",
        "huggingface-cli download ByteDance/LatentSync-1.6 latentsync_unet.pt "
        "--local-dir /opt/LatentSync/checkpoints",
    )
    .env({"LIPSYNC_BACKEND": "latentsync"})
)


# --- Stage 1: TTS ----------------------------------------------------------
@app.function(image=tts_image, gpu="T4", volumes=VOLUMES, secrets=[gcp_secret], timeout=3600)
def tts_fn(job_id: str) -> str:
    from pathlib import Path

    from app.config import Config
    from app.models import tts_chatterbox
    from app.storage import Store

    cfg = Config.load()
    _write_creds()
    store = Store(cfg)
    job = store.get_job(job_id)
    work = Path(cfg.work_dir) / job_id
    voice = store.download(job["voiceSamplePath"], work / "voice.wav")
    audio = work / "audio.wav"
    tts_chatterbox.synthesize(
        text=job["text"], voice_sample=voice, out_wav=audio, device="cuda",
        on_progress=lambda p: store.set_progress(job_id, 0.4 * p),
    )
    return store.upload(audio, f"inputs/{job_id}/audio.wav", content_type="audio/wav")


# --- Stage 2: lip sync (one function per backend) --------------------------
def _lipsync(job_id: str, backend_mod) -> str:
    from pathlib import Path

    from app.config import Config
    from app.storage import Store

    cfg = Config.load()
    _write_creds()
    store = Store(cfg)
    job = store.get_job(job_id)
    work = Path(cfg.work_dir) / job_id
    face = store.download(job["faceImagePath"], work / "face.png")
    audio = store.download(f"inputs/{job_id}/audio.wav", work / "audio.wav")
    out = work / "out.mp4"
    backend_mod.generate(face_image=face, audio_wav=audio, out_mp4=out,
                         weights_dir=cfg.weights_dir, device="cuda")
    store.set_progress(job_id, 0.95)
    return store.upload(out, f"outputs/{job_id}.mp4", content_type="video/mp4")


@app.function(image=musetalk_image, gpu="L4", volumes=VOLUMES, secrets=[gcp_secret], timeout=3600)
def lipsync_musetalk(job_id: str) -> str:
    from app.models import lipsync_musetalk
    return _lipsync(job_id, lipsync_musetalk)


@app.function(image=latentsync_image, gpu="A10G", volumes=VOLUMES, secrets=[gcp_secret],
              timeout=24 * 3600)
def lipsync_latentsync(job_id: str) -> str:
    from app.models import lipsync_latentsync
    return _lipsync(job_id, lipsync_latentsync)


# --- Coordinator: chains the stages (cheap CPU) ----------------------------
@app.function(image=_shared(modal.Image.debian_slim()), secrets=[gcp_secret], timeout=24 * 3600)
def render(job_id: str, backend: str = "musetalk") -> str:
    from app.config import Config
    from app.storage import Store

    cfg = Config.load()
    _write_creds()
    store = Store(cfg)
    store.update_job(job_id, status="running", progress=0.0, error=None, backend=backend)
    try:
        tts_fn.remote(job_id)                       # stage 1 (T4)
        lipsync = lipsync_latentsync if backend == "latentsync" else lipsync_musetalk
        out = lipsync.remote(job_id)                # stage 2 (L4 / A10G)
        store.update_job(job_id, status="succeeded", progress=1.0, outputPath=out)
        return out
    except Exception as exc:  # surface failure to the job doc
        store.update_job(job_id, status="failed", error=str(exc))
        raise


# --- HTTP entrypoint Optiq's Next.js backend calls -------------------------
@app.function(image=modal.Image.debian_slim().pip_install("fastapi[standard]"), secrets=[gcp_secret])
@modal.fastapi_endpoint(method="POST")
def submit(data: dict):
    from fastapi import HTTPException

    if data.get("token") != os.environ.get("OPTIQ_SUBMIT_TOKEN"):
        raise HTTPException(status_code=401, detail="bad token")
    job_id = data["jobId"]
    backend = data.get("backend", "musetalk")
    call = render.spawn(job_id, backend)
    return {"jobId": job_id, "backend": backend, "callId": call.object_id}


def _write_creds() -> None:
    """Decode the SA key from the secret into GOOGLE_APPLICATION_CREDENTIALS."""
    import base64
    import pathlib

    creds = pathlib.Path("/tmp/gcp.json")
    if not creds.exists():
        creds.write_bytes(base64.b64decode(os.environ["GCP_SA_B64"]))
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(creds)
