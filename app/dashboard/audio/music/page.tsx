"use client";

// Optiq Music — the score studio. A mood-preset rail, a wall of generated
// tracks, and a docked brief console. Backed by Lyria via /api/music/generate.

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, X } from "lucide-react";
import { useAuth } from "../../../../components/AuthProvider";
import ConfirmGenerationModal from "../../../../components/ConfirmGenerationModal";
import AudioConsole from "../_components/AudioConsole";
import AudioProjectsGrid from "../../_shared/AudioProjectsGrid";
import { AudioItem } from "../_components/types";

const MAX_CHARS = 2000;
const MUSIC_COST = 100;

const MOODS = [
  "Afrobeat",
  "Amapiano",
  "Cinematic",
  "Upbeat pop",
  "Emotional piano",
  "Hip-hop",
  "Ambient",
  "Corporate uplift",
  "Traditional West African",
  "Lo-fi",
];

export default function MusicStudio() {
  const { apiFetch, profile, refreshProfile } = useAuth();

  const [prompt, setPrompt] = useState("");
  const [history, setHistory] = useState<AudioItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [openedMenuId, setOpenedMenuId] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const balance = profile?.credits ?? 0;

  const loadHistory = useCallback(() => {
    apiFetch<{ items: AudioItem[] }>("/api/generations?type=music")
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

  const addMood = (mood: string) => setPrompt((prev) => (prev.trim() ? `${prev.trim()}, ${mood.toLowerCase()}` : mood));

  const handleEnhance = async () => {
    if (!prompt.trim() || enhancing) return;
    setEnhancing(true);
    setError(null);
    try {
      const data = await apiFetch<{ prompt: string }>("/api/enhance", {
        method: "POST",
        body: JSON.stringify({ prompt }),
      });
      setPrompt(data.prompt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enhance failed");
    } finally {
      setEnhancing(false);
    }
  };

  const triggerGenerate = () => {
    if (!prompt.trim() || busy) return;
    setConfirmOpen(true);
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || busy) return;
    setBusy(true);
    setError(null);

    const tempId = `temp_${Date.now()}`;
    const original = prompt;
    setHistory((prev) => [
      { id: tempId, status: "queued", prompt: original, audioUrl: null, createdAt: new Date().toISOString() },
      ...prev,
    ]);
    setPrompt("");

    try {
      const data = await apiFetch<{ id: string; url: string }>("/api/music/generate", {
        method: "POST",
        body: JSON.stringify({ prompt: original }),
      });
      setHistory((prev) =>
        prev.map((item) =>
          item.id === tempId ? { ...item, id: data.id, status: "succeeded", audioUrl: data.url } : item
        )
      );
      void refreshProfile();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Music generation failed");
      setHistory((prev) => prev.filter((item) => item.id !== tempId));
    } finally {
      setBusy(false);
    }
  };

  const deleteTrack = (id: string, e: React.MouseEvent) => {
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
      {/* Mood rail (desktop) */}
      <aside className="hidden w-full shrink-0 space-y-6 overflow-y-auto border-b border-neutral-900 bg-background p-5 sm:block sm:w-64 sm:border-b-0 sm:border-r sm:pt-24">
        <Link
          href="/dashboard/audio"
          className="group flex w-fit items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-neutral-500 transition-colors hover:text-white"
        >
          <ArrowLeft size={12} className="transition-transform group-hover:-translate-x-0.5" />
          Back
        </Link>
        <div>
          <p className="eyebrow mb-3">Mood &amp; genre</p>
          <div className="flex flex-wrap gap-1.5">
            {MOODS.map((m) => (
              <button
                key={m}
                onClick={() => addMood(m)}
                className="rounded-full border border-neutral-800 bg-neutral-950 px-3 py-1.5 text-[11px] font-semibold text-neutral-300 transition-colors hover:border-emerald-500/40 hover:bg-[#10231b] hover:text-emerald-200"
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main className="relative flex flex-1 flex-col overflow-hidden bg-black">
        <div className="min-h-0 flex-1 overflow-y-auto p-4 pt-20 sm:p-6 sm:pt-24 md:p-8">
          <div className="mb-8 flex items-center justify-between border-b border-neutral-900 pb-4">
            <div>
              <span className="block font-mono text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                OPTIQ MUSIC
              </span>
              <h2 className="mt-1 text-[18px] font-bold tracking-tight text-white">All Tracks</h2>
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
            variant="music"
            openedMenuId={openedMenuId}
            setOpenedMenuId={setOpenedMenuId}
            deletingIds={deletingIds}
            onDelete={deleteTrack}
            emptyTitle="No tracks yet"
            emptyHint="Describe a mood or scene below and generate your first score."
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
          value={prompt}
          setValue={setPrompt}
          placeholder="A warm, uplifting afrobeat bed with gentle percussion for a brand advert…"
          onGenerate={triggerGenerate}
          busy={busy}
          generateLabel={`Compose · ${MUSIC_COST}`}
          busyLabel="Composing…"
          maxLength={MAX_CHARS}
          hint="~30s instrumental"
          showEnhance
          onEnhance={() => void handleEnhance()}
          enhancing={enhancing}
        >
          {/* Mobile-only mood strip */}
          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 sm:hidden">
            {MOODS.map((m) => (
              <button
                key={m}
                onClick={() => addMood(m)}
                className="shrink-0 rounded-full border border-neutral-800 bg-[#07090f] px-3 py-1.5 text-[11px] font-semibold text-neutral-300"
              >
                {m}
              </button>
            ))}
          </div>
        </AudioConsole>
      </main>

      <ConfirmGenerationModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void handleGenerate()}
        cost={MUSIC_COST}
        balance={balance}
        title="Confirm Optiq Music"
        description="Original instrumental score (~30s)"
        actionLabel="Compose Track"
      />
    </div>
  );
}
