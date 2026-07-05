"""Cloud Run Job entrypoint.

Executed once per render. The job id is passed via the JOB_ID env override on the
Cloud Run Job execution. Exit 0 = success, non-zero = failure (Cloud Run retries
per the job's retry policy).
"""
from __future__ import annotations

import logging
import os
import sys
import traceback

from .config import Config
from .pipeline import run
from .storage import Store

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("optiq.worker")


def main() -> int:
    job_id = os.environ.get("JOB_ID")
    if not job_id:
        log.error("JOB_ID env var is required")
        return 2

    cfg = Config.load()
    store = Store(cfg)
    log.info("starting job %s (backend=%s)", job_id, cfg.backend)

    try:
        job = store.get_job(job_id)
        store.update_job(job_id, status="running", progress=0.0, error=None)
        object_path = run(cfg, store, job_id, job)
        store.update_job(job_id, status="succeeded", progress=1.0, outputPath=object_path)
        log.info("job %s succeeded -> %s", job_id, object_path)
        return 0
    except Exception as exc:  # noqa: BLE001 — surface any failure to the job doc
        log.error("job %s failed: %s\n%s", job_id, exc, traceback.format_exc())
        try:
            store.update_job(job_id, status="failed", error=str(exc))
        except Exception:  # noqa: BLE001
            log.exception("could not write failure status for %s", job_id)
        return 1


if __name__ == "__main__":
    sys.exit(main())
