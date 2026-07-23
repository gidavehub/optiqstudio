"use client";

// Optiq Voice Engine — rebuilt on the Image/Video studio layout: a speaker rail
// (faces + sample playback), a wall of past takes, and a docked script console.
// No voice cloning — the 16 prebuilt speakers are the whole engine.

import React, { useCallback, useEffect, useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "../../../../components/AuthProvider";
import ConfirmGenerationModal from "../../../../components/ConfirmGenerationModal";
import VoiceRail from "../_components/VoiceRail";
import AudioConsole from "../_components/AudioConsole";
import AudioProjectsGrid from "../../_shared/AudioProjectsGrid";
import { VOICE_PROFILES } from "../_components/voiceProfiles";
import { AudioItem } from "../_components/types";

const MAX_CHARS = 4000;
const estimateCost = (len: number) => Math.max(15, Math.ceil(len / 100) * 10);

export default function VoiceEngineStudio() {
  const { apiFetch, profile, refreshProfile } = useAuth();

  const [selectedId, setSelectedId] = useState(VOICE_PROFILES[0].id);
  const [script, setScript] = useState("");
  const [history, setHistory] = useState<AudioItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [openedMenuId, setOpenedMenuId] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const selected = VOICE_PROFILES.find((p) => p.id === selectedId) ?? VOICE_PROFILES[0];
  const cost = estimateCost(script.length);
  const balance = profile?.credits ?? 0;

  const loadHistory = useCallback(() => {
    apiFetch<{ items: AudioItem[] }>("/api/generations?type=audio")
      .then((d) => setHistory(d.items || []))
      .catch(() => {});
  }, [apiFetch]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    const close = () => setOpenedMenuId(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  const triggerGenerate = () => {
    if (!script.trim() || busy) return;
    setConfirmOpen(true);
  };

  const handleGenerate = async () => {
    if (!script.trim() || busy) return;
    setBusy(true);
    setError(null);

    const tempId = `temp_${Date.now()}`;
    const original = script;
    setHistory((prev) => [
      { id: tempId, status: "queued", prompt: original, audioUrl: null, createdAt: new Date().toISOString() },
      ...prev,
    ]);
    setScript("");

    try {
      const data = await apiFetch<{ id: string; url: string }>("/api/voice/generate", {
        method: "POST",
        body: JSON.stringify({ text: original, voice: selected.voice }),
      });
      setHistory((prev) =>
        prev.map((item) =>
          item.id === tempId ? { ...item, id: data.id, status: "succeeded", audioUrl: data.url } : item
        )
      );
      void refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Voice synthesis failed");
      setHistory((prev) => prev.filter((item) => item.id !== tempId));
    } finally {
      setBusy(false);
    }
  };

  const deleteTake = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenedMenuId(null);
    setDeletingIds((prev) => new Set(prev).add(id));
    if (!id.startsWith("temp_")) {
      void apiFetch(`/api/generations?id=${id}`, { method: "DELETE" })
        .catch(() => {})
        .finally(() => void refreshProfile());
    }
    setTimeout(() => {
      setHistory((prev) => prev.filter((item) => item.id !== id));
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 320);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-black text-white sm:flex-row">
      <VoiceRail selectedId={selectedId} onSelect={setSelectedId} />

      <main className="relative flex flex-1 flex-col overflow-hidden bg-black">
        <div className="min-h-0 flex-1 overflow-y-auto p-4 pt-20 sm:p-6 sm:pt-24 md:p-8">
          <div className="mb-8 flex items-center justify-between border-b border-neutral-900 pb-4">
            <div>
              <span className="block font-mono text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                OPTIQ VOICE ENGINE
              </span>
              <h2 className="mt-1 text-[18px] font-bold tracking-tight text-white">All Voiceover Takes</h2>
            </div>
          </div>

          <AudioProjectsGrid
            items={history.map((h) => ({
              id: h.id,
              status: h.status || "succeeded",
              prompt: h.prompt,
              audioUrl: h.audioUrl,
              createdAt: h.createdAt,
            }))}
            variant="voice"
            openedMenuId={openedMenuId}
            setOpenedMenuId={setOpenedMenuId}
            deletingIds={deletingIds}
            onDelete={deleteTake}
            emptyTitle="No voiceover takes yet"
            emptyHint="Pick a speaker, write a script below, and your takes will appear here."
          />
        </div>

        {error && (
          <div className="mx-4 mb-3 flex animate-rise items-center justify-between rounded-xl border border-red-950 bg-red-950/40 p-4 text-xs text-red-300 sm:mx-8">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-neutral-500 hover:text-white">
              <X size={14} />
            </button>
          </div>
        )}

        <AudioConsole
          value={script}
          setValue={setScript}
          placeholder={`Write ${selected.name}'s narration script…`}
          onGenerate={triggerGenerate}
          busy={busy}
          generateLabel={`Synthesize · ${cost}`}
          busyLabel="Synthesizing…"
          maxLength={MAX_CHARS}
          hint={`${selected.name} · ${selected.accent}`}
        >
          {/* Mobile-only speaker strip — desktop uses the left rail */}
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1 sm:hidden">
            {VOICE_PROFILES.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border py-1 pl-1 pr-2.5 transition-colors ${
                  selectedId === p.id ? "border-blue-500 bg-[#0c152d]" : "border-neutral-800 bg-[#07090f]"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/media/voice-faces/${p.id}.jpg`} alt="" className="h-6 w-6 rounded-full object-cover" />
                <span className="text-[11px] font-semibold text-neutral-200">{p.name}</span>
              </button>
            ))}
          </div>
        </AudioConsole>
      </main>

      <ConfirmGenerationModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void handleGenerate()}
        cost={cost}
        balance={balance}
        title="Confirm Voice Synthesis"
        description={`Voiceover with ${selected.name} (${selected.accent})`}
        actionLabel="Synthesize Voice"
      />
    </div>
  );
}
