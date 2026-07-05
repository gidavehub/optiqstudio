"""Runtime configuration, sourced from environment variables.

Cloud Run Job execution overrides `JOB_ID` per invocation; everything else is set
once on the job definition.
"""
from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Config:
    project_id: str
    bucket: str
    collection: str
    backend: str          # "musetalk" | "latentsync"
    device: str           # "cuda" | "cpu"
    weights_dir: str
    work_dir: str

    @staticmethod
    def load() -> "Config":
        backend = os.environ.get("LIPSYNC_BACKEND", "musetalk").lower()
        if backend not in ("musetalk", "latentsync"):
            raise ValueError(f"LIPSYNC_BACKEND must be musetalk|latentsync, got {backend!r}")
        return Config(
            project_id=os.environ.get("PROJECT_ID", "davelabs-tools"),
            bucket=os.environ.get("BUCKET", "davelabs-tools-optiq-avatar"),
            collection=os.environ.get("FIRESTORE_COLLECTION", "avatarJobs"),
            backend=backend,
            device=os.environ.get("DEVICE", "cuda"),
            weights_dir=os.environ.get("WEIGHTS_DIR", "/weights"),
            work_dir=os.environ.get("WORK_DIR", "/tmp/optiq"),
        )
