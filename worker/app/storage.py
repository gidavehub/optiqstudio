"""GCS object IO + Firestore job-status updates.

Kept deliberately small: the worker downloads inputs, uploads one output, and
patches the job document. Download-URL minting is the app's job, not ours.
"""
from __future__ import annotations

import time
from pathlib import Path
from typing import Any

from google.cloud import firestore, storage

from .config import Config


class Store:
    def __init__(self, cfg: Config) -> None:
        self._cfg = cfg
        self._gcs = storage.Client(project=cfg.project_id)
        self._bucket = self._gcs.bucket(cfg.bucket)
        self._db = firestore.Client(project=cfg.project_id)

    # --- Firestore --------------------------------------------------------
    def _doc(self, job_id: str):
        return self._db.collection(self._cfg.collection).document(job_id)

    def get_job(self, job_id: str) -> dict[str, Any]:
        snap = self._doc(job_id).get()
        if not snap.exists:
            raise KeyError(f"job {job_id} not found in {self._cfg.collection}")
        return snap.to_dict() or {}

    def update_job(self, job_id: str, **fields: Any) -> None:
        fields["updatedAt"] = firestore.SERVER_TIMESTAMP
        self._doc(job_id).set(fields, merge=True)

    def set_progress(self, job_id: str, progress: float) -> None:
        self.update_job(job_id, progress=round(float(progress), 3))

    # --- GCS --------------------------------------------------------------
    def download(self, object_path: str, dest: Path) -> Path:
        dest.parent.mkdir(parents=True, exist_ok=True)
        self._bucket.blob(object_path).download_to_filename(str(dest))
        return dest

    def upload(self, src: Path, object_path: str, content_type: str | None = None) -> str:
        blob = self._bucket.blob(object_path)
        blob.upload_from_filename(str(src), content_type=content_type)
        return object_path


class Timer:
    """Accumulates per-stage timings to store back on the job doc."""

    def __init__(self) -> None:
        self.timings: dict[str, float] = {}

    def __call__(self, stage: str):
        return _Span(self, stage)


class _Span:
    def __init__(self, timer: Timer, stage: str) -> None:
        self._timer, self._stage = timer, stage

    def __enter__(self):
        self._t0 = time.perf_counter()
        return self

    def __exit__(self, *exc):
        self._timer.timings[self._stage] = round(time.perf_counter() - self._t0, 2)
        return False
