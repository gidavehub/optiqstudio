# Modal setup (GPU render host)

GPU renders run on **Modal** ($30/mo free credit, scale-to-zero). Storage +
Firestore stay on GCP (`davelabs-tools`). Python 3.12 + the Modal CLI are already
installed on this machine at:

- Python: `C:\Users\conne\AppData\Local\Programs\Python\Python312\python.exe`
- Modal:  `python -m modal ...`

## 1. Your one manual step — create + auth a Modal account

1. Sign up (free): https://modal.com  (GitHub/Google login is fine)
2. Authenticate the CLI (opens your browser to authorize):

   ```powershell
   & "C:\Users\conne\AppData\Local\Programs\Python\Python312\python.exe" -m modal setup
   ```

That writes a token to `~/.modal.toml`. Once done, everything below is automated.

## 2. Secret (automated after auth)

Named secret `optiq-gcp` carries:
- `GCP_SA_JSON` — the optiq-avatar-worker service-account key (already minted to
  the scratchpad; **never committed**).
- `OPTIQ_SUBMIT_TOKEN` — random token the Next.js backend sends to the `submit`
  endpoint so strangers can't trigger GPU spend.

## 3. Deploy

```powershell
& "...python.exe" -m modal deploy worker/modal_app.py
```

Prints the public `submit` endpoint URL → goes into Optiq's server env as
`MODAL_SUBMIT_URL` (+ `OPTIQ_SUBMIT_TOKEN`).

## Architecture

```
Next.js → GCS (image + voice) + Firestore (job doc, status=queued)
        → POST {jobId, backend, token}  ─▶  Modal submit endpoint
                                             └─ spawns render_musetalk (L4)
                                                or render_latentsync (A10G)
                                                  ├ Chatterbox  → audio
                                                  ├ lip-sync    → mp4
                                                  ├ upload mp4  → GCS
                                                  └ Firestore status=succeeded
Next.js polls Firestore → signed URL → play
```
