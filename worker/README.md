# Optiq Avatar Worker

Self-hosted, **open-source-only** talking-avatar pipeline. Runs as a **Cloud Run Job**
(GPU L4, scale-to-zero) on GCP project `davelabs-tools`.

## Pipeline

```
text + voice sample + face image
        │
        ▼  Chatterbox (MIT)          → cloned-voice audio (.wav)
        ▼  MuseTalk | LatentSync     → lip-synced video (.mp4)
        ▼
   Firebase Storage + Firestore (job status)
```

Two lip-sync backends, selected per job:

| Backend      | Speed            | Quality   | Use when                        |
|--------------|------------------|-----------|---------------------------------|
| `musetalk`   | ~real-time       | good      | fast previews / long scripts    |
| `latentsync` | slow (diffusion) | best      | final high-quality renders      |

Because MuseTalk and LatentSync have conflicting Python deps, each ships as its
**own image / Cloud Run Job**, both built from this one codebase via the
`LIPSYNC_BACKEND` build arg. Chatterbox is bundled in both.

## Job contract (Firestore collection `avatarJobs/{jobId}`)

```jsonc
{
  "status": "queued|running|succeeded|failed",
  "backend": "musetalk|latentsync",
  "text": "what the avatar should say",
  "voiceSamplePath": "inputs/<jobId>/voice.wav",   // bucket-relative
  "faceImagePath":   "inputs/<jobId>/face.png",
  "outputPath":      "outputs/<jobId>.mp4",         // set on success
  "progress": 0.0,
  "error": null,
  "timings": {}
}
```

The worker never mints download URLs — the Next.js app (firebase-admin) does that
when it sees `status: succeeded`, so the worker needs no signing permissions.

## Layout

```
worker/
  app/
    main.py              # Cloud Run Job entrypoint (reads JOB_ID)
    config.py            # env config
    storage.py           # GCS download/upload + Firestore status
    pipeline.py          # TTS -> lip-sync orchestration
    models/
      tts_chatterbox.py
      lipsync_musetalk.py
      lipsync_latentsync.py
  scripts/download_weights.py
  requirements.txt
  Dockerfile             # ARG LIPSYNC_BACKEND=musetalk|latentsync
  cloudbuild.yaml
```

## Build & deploy

See `cloudbuild.yaml`. Weights live in `gs://davelabs-tools-optiq-avatar/weights/`
and are synced into the image at build time (or mounted via GCS FUSE — TBD after
benchmarking cold-start cost).
