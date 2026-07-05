#!/usr/bin/env bash
# Clone + install the selected lip-sync backend into its own layer.
# Exact commit pins and weight fetches are finalized in the model-sourcing step;
# these are the current upstream entrypoints.
set -euo pipefail

BACKEND="${1:?usage: setup_backend.sh <musetalk|latentsync>}"

case "$BACKEND" in
  musetalk)
    git clone --depth 1 https://github.com/TMElyralab/MuseTalk /opt/MuseTalk
    pip install -r /opt/MuseTalk/requirements.txt
    # MuseTalk also needs mmlab stack (mmcv/mmpose/mmdet) — pinned during sourcing.
    ;;
  latentsync)
    git clone --depth 1 https://github.com/bytedance/LatentSync /opt/LatentSync
    pip install -r /opt/LatentSync/requirements.txt
    ;;
  *)
    echo "unknown backend: $BACKEND" >&2
    exit 1
    ;;
esac

echo "backend $BACKEND installed"
