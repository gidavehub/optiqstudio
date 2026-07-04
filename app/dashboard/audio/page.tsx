"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Download, Loader2, Mic, Play } from "lucide-react";
import { useAuth } from "../../../components/AuthProvider";
import ConfirmGenerationModal from "../../../components/ConfirmGenerationModal";

const VOICES = [
  { id: "Kore", label: "Awa (Wolof)", vibe: "Soft, warm female Wolof speaker" },
  { id: "Charon", label: "Moussa (Wolof)", vibe: "Deep, resonant male Wolof speaker" },
  { id: "Leda", label: "Fatou (Mandinka)", vibe: "Bright, youthful female Mandinka speaker" },
  { id: "Fenrir", label: "Lamin (Mandinka)", vibe: "Gravelly, strong male Mandinka speaker" },
  { id: "Aoede", label: "Chioma (Igbo)", vibe: "Melodic, expressive female Igbo speaker" },
  { id: "Orus", label: "Chinedu (Igbo)", vibe: "Authoritative, firm male Igbo speaker" },
  { id: "Puck", label: "Efe (Nigerian English)", vibe: "Energetic, clear female English speaker" },
  { id: "Enceladus", label: "Kofi (African-British)", vibe: "Contemplative, British-African male accent" },
];

interface AudioItem {
  id: string;
  prompt: string;
  audioUrl: string | null;
  createdAt: string;
}

export default function VoiceStudio() {
  const { apiFetch, profile, pricing, refreshProfile } = useAuth();
  const [text, setText] = useState("");
  const [voice, setVoice] = useState("Kore");
  const [style, setStyle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<AudioItem[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const triggerGenerate = () => {
    if (!text.trim() || busy) return;
    setConfirmOpen(true);
  };

  const per100 = pricing?.costs.ttsPer100Chars ?? 1;
  const minCharge = pricing?.costs.ttsMinimum ?? 5;
  const cost = Math.max(minCharge, Math.ceil(text.length / 100) * per100);

  const loadHistory = useCallback(() => {
    apiFetch<{ items: AudioItem[] }>("/api/generations?type=audio")
      .then((d) => setHistory(d.items))
      .catch(() => {});
  }, [apiFetch]);

  useEffect(loadHistory, [loadHistory]);

  const generate = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const data = await apiFetch<{ url: string }>("/api/voice/generate", {
        method: "POST",
        body: JSON.stringify({ text, voice, style: style || undefined }),
      });
      setResultUrl(data.url);
      loadHistory();
      void refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Synthesis failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-8 py-10 w-full">
      <h1 className="display text-2xl">Voice Studio</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Studio-grade narration and voiceovers, synthesized on demand.
      </p>

      <div className="mt-8 grid gap-8 md:grid-cols-[1fr_260px]">
        <div>
          <textarea
            rows={7}
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={4000}
            placeholder="Paste or write your script…"
            className="w-full resize-none rounded-xl border border-line bg-surface p-4 text-sm placeholder:text-neutral-600 focus:border-white/40"
          />
          <div className="mt-1 flex justify-between text-[11px] text-neutral-600">
            <span>{text.length.toLocaleString()} / 4,000 characters</span>
            <span>{cost} credits</span>
          </div>

          <input
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            placeholder="Delivery directions — e.g. “slow, movie-trailer gravitas”"
            className="mt-3 w-full rounded-xl border border-line bg-surface px-4 py-3 text-sm placeholder:text-neutral-600 focus:border-white/40"
          />

          <button
            onClick={triggerGenerate}
            disabled={busy || !text.trim()}
            className="mt-4 flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-medium text-black hover:bg-neutral-200 transition-colors disabled:opacity-40"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Mic size={14} />}
            {busy ? "Synthesizing…" : `Generate voiceover · ${cost}`}
          </button>

          {error && (
            <p className="mt-3 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}

          {resultUrl && (
            <div className="mt-6 rounded-xl border border-line bg-surface p-4">
              <audio src={resultUrl} controls autoPlay className="w-full" />
              <div className="mt-3 flex justify-end">
                <a
                  href={resultUrl}
                  download
                  className="flex items-center gap-2 rounded-full border border-line px-4 py-1.5 text-xs hover:bg-surface-2 transition-colors"
                >
                  <Download size={12} /> Download WAV
                </a>
              </div>
            </div>
          )}

          {history.length > 0 && (
            <div className="mt-10">
              <p className="eyebrow mb-3">Previous takes</p>
              <div className="space-y-2">
                {history.slice(0, 8).map((h) => (
                  <button
                    key={h.id}
                    onClick={() => h.audioUrl && setResultUrl(h.audioUrl)}
                    className="flex w-full items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2.5 text-left hover:border-white/25 transition-colors"
                  >
                    <Play size={13} className="shrink-0 text-neutral-400" />
                    <span className="truncate text-xs text-neutral-400">{h.prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Voice picker */}
        <div>
          <p className="eyebrow mb-3">Voice profile</p>
          <div className="space-y-1.5">
            {VOICES.map((v) => (
              <button
                key={v.id}
                onClick={() => setVoice(v.id)}
                className={`w-full rounded-lg border px-3 py-2.5 text-left transition-colors ${
                  voice === v.id
                    ? "border-white/40 bg-surface-2"
                    : "border-line bg-surface hover:border-white/20"
                }`}
              >
                <p className="text-sm font-medium">{v.label}</p>
                <p className="text-[11px] text-neutral-500">{v.vibe}</p>
              </button>
            ))}
          </div>
      </div>
      <ConfirmGenerationModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={generate}
        cost={cost}
        balance={profile?.credits ?? 0}
        title="Confirm Voice Synthesis"
        description={`You are about to synthesize a take using the selected localized profile. This will deduct ${cost} credits from your ledger.`}
        actionLabel="Synthesize Voice"
      />
    </div>
    </div>
    </div>
  );
}
