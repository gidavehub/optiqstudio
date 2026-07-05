"""Modal deployment for the Optiq voice cloning pipeline.

Renders run on Modal (scale-to-zero, $30/mo free credit). 
Storage + Firestore stay on GCP (`davelabs-tools`).

A single Chatterbox (MIT) worker runs Voice Cloning on a T4 GPU.
A cheap CPU `render` coordinator executes the voice synthesis job asynchronously.
The public `submit` endpoint (token-guarded) spawns the task.

GCP creds + submit token come from the `optiq-gcp` Modal secret.
"""
from __future__ import annotations

import os
import modal

app = modal.App("optiq-avatar") # Keep same app name to preserve URL/secrets matching

# HF cache persists across cold starts
weights = modal.Volume.from_name("optiq-weights", create_if_missing=True)
gcp_secret = modal.Secret.from_name("optiq-gcp")

WEIGHTS_DIR = "/weights"
VOLUMES = {WEIGHTS_DIR: weights}

GCLOUD = ("google-cloud-storage>=2.16", "google-cloud-firestore>=2.16")


def _shared(img: modal.Image) -> modal.Image:
    """GCP clients + env + our worker/app source, added last on every image."""
    return (
        img.pip_install(*GCLOUD)
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


# --- Stage 1: TTS / Voice Cloning ------------------------------------------
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
        on_progress=lambda p: store.set_progress(job_id, p),
    )
    return store.upload(audio, f"generations/{job['uid']}/{job_id}.wav", content_type="audio/wav")


# --- Coordinator: runs TTS (cheap CPU) -------------------------------------
@app.function(image=_shared(modal.Image.debian_slim()), secrets=[gcp_secret], timeout=24 * 3600)
def render(job_id: str) -> str:
    from app.config import Config
    from app.storage import Store

    cfg = Config.load()
    _write_creds()
    store = Store(cfg)
    store.update_job(job_id, status="running", progress=0.0, error=None)
    try:
        audio_url = tts_fn.remote(job_id)
        store.update_job(job_id, status="succeeded", progress=1.0, audioUrl=audio_url)
        return audio_url
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
    call = render.spawn(job_id)
    return {"jobId": job_id, "callId": call.object_id}


def _write_creds() -> None:
    """Decode the SA key from the secret into GOOGLE_APPLICATION_CREDENTIALS."""
    import base64
    import pathlib

    creds = pathlib.Path("/tmp/gcp.json")
    if not creds.exists():
        creds.write_bytes(base64.b64decode(os.environ["GCP_SA_B64"]))
    os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = str(creds)
