# One codebase, two images. Build once per backend:
#   --build-arg LIPSYNC_BACKEND=musetalk
#   --build-arg LIPSYNC_BACKEND=latentsync
#
# Base carries CUDA 12.x + PyTorch matched to the L4 (sm_89) on Cloud Run GPU.
FROM pytorch/pytorch:2.4.1-cuda12.1-cudnn9-runtime

ARG LIPSYNC_BACKEND=musetalk
ENV LIPSYNC_BACKEND=${LIPSYNC_BACKEND} \
    PYTHONUNBUFFERED=1 \
    HF_HOME=/weights/hf \
    PIP_NO_CACHE_DIR=1

# System deps: ffmpeg for audio/video muxing, git to clone model repos.
RUN apt-get update && apt-get install -y --no-install-recommends \
        ffmpeg git build-essential libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Common Python deps (Chatterbox + GCP clients).
COPY requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

# --- Backend-specific setup ------------------------------------------------
# Each model repo is cloned and installs its OWN pinned requirements so the two
# backends never share a conflicting dependency tree (they live in separate
# images). Exact commit pins + weight fetches are finalized during model-sourcing.
COPY scripts/ /app/scripts/
RUN bash /app/scripts/setup_backend.sh "${LIPSYNC_BACKEND}"

# App code last for fast rebuilds.
COPY app/ /app/app/

# Weights are baked or GCS-mounted at /weights (decided after cold-start bench).
ENV WEIGHTS_DIR=/weights

ENTRYPOINT ["python", "-m", "app.main"]
