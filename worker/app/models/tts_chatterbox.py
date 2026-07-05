"""Chatterbox (Resemble AI, MIT) — zero-shot voice-cloning TTS.

Repo:  https://github.com/resemble-ai/chatterbox
Model: resemble-ai/chatterbox on Hugging Face (MIT weights).

Chatterbox has a clean Python API, so no subprocess needed. It clones the target
voice from a short reference clip (`audio_prompt_path`) and speaks `text` in it.
Long scripts are chunked by sentence to keep memory bounded and quality stable.
"""
from __future__ import annotations

import re
from pathlib import Path

_MODEL = None  # lazily loaded singleton (weights are multi-hundred-MB)


def _load(device: str):
    global _MODEL
    if _MODEL is None:
        from chatterbox.tts import ChatterboxTTS  # imported lazily; heavy

        _MODEL = ChatterboxTTS.from_pretrained(device=device)
    return _MODEL


def _split_sentences(text: str, max_chars: int = 300) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    chunks: list[str] = []
    buf = ""
    for p in parts:
        if len(buf) + len(p) + 1 <= max_chars:
            buf = f"{buf} {p}".strip()
        else:
            if buf:
                chunks.append(buf)
            buf = p
    if buf:
        chunks.append(buf)
    return chunks or [text.strip()]


def synthesize(
    text: str,
    voice_sample: Path,
    out_wav: Path,
    device: str = "cuda",
    on_progress=None,
) -> Path:
    """Generate speech for `text` in the cloned voice; write a 24 kHz wav."""
    import torch
    import torchaudio

    model = _load(device)
    chunks = _split_sentences(text)
    waves = []
    for i, chunk in enumerate(chunks):
        wav = model.generate(chunk, audio_prompt_path=str(voice_sample))
        waves.append(wav)
        if on_progress:
            on_progress((i + 1) / len(chunks))

    audio = torch.cat(waves, dim=-1)
    out_wav.parent.mkdir(parents=True, exist_ok=True)
    torchaudio.save(str(out_wav), audio, model.sr)
    return out_wav
