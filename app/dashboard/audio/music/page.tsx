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
import { useGenerationHistory } from "../../_shared/useGenerationHistory";
import { useReusePrompt } from "../../_shared/useReusePrompt";
import { AudioItem } from "../_components/types";

const MAX_CHARS = 2000;

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
  const { apiFetch, profile, pricing } = useAuth();

  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [openedMenuId, setOpenedMenuId] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const reusePrompt = useReusePrompt();
  const balance = profile?.credits ?? 0;

  // Music is billed per generated second — Lyria returns a single ~30s clip.
  const trackSeconds = pricing?.costs.musicDefaultSeconds ?? 30;
  const musicCost = Math.ceil(trackSeconds * (pricing?.costs.musicPerSecond ?? 2));

  const fetchTracks = useCallback(
    () => apiFetch<{ items: AudioItem[] }>("/api/generations?type=music").then((d) => d.items || []),
    [apiFetch]
  );
  const { history, freshIds, addOptimistic, resolveOptimistic, removeItem } =
    useGenerationHistory<AudioItem>({ fetcher: fetchTracks });

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
    addOptimistic({
      id: tempId,
      status: "queued",
      prompt: original,
      audioUrl: null,
      createdAt: new Date().toISOString(),
    } as AudioItem);
    setPrompt("");

    try {
      const data = await apiFetch<{ id: string; url: string }>("/api/music/generate", {
        method: "POST",
        body: JSON.stringify({ prompt: original }),
      });
      resolveOptimistic(tempId, {
        id: data.id,
        status: "succeeded",
        audioUrl: data.url,
      } as Partial<AudioItem>);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Music generation failed");
      removeItem(tempId);
    } finally {
      setBusy(false);
    }
  };

  const handleReuse = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenedMenuId(null);
    const reused = await reusePrompt(id);
    if (reused) setPrompt(reused.prompt);
  };

  const deleteTrack = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenedMenuId(null);
    setDeletingIds((prev) => new Set(prev).add(id));
    if (!id.startsWith("temp_")) {
      void apiFetch(`/api/generations?id=${id}`, { method: "DELETE" }).catch(() => {});
    }
    setTimeout(() => {
      removeItem(id);
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 320);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-background text-foreground sm:flex-row">
      {/* Mood rail (desktop) */}
      <aside className="hidden w-full shrink-0 space-y-6 overflow-y-auto border-b border-line bg-background p-5 sm:block sm:w-64 sm:border-b-0 sm:border-r sm:pt-24">
        <Link
          href="/dashboard/audio"
          className="group flex w-fit items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-muted transition-colors hover:text-foreground"
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
                className="rounded-full border border-line bg-background px-3 py-1.5 text-[11px] font-semibold text-ink-2 transition-colors hover:border-success hover:bg-[#10231b] hover:text-success"
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <main className="relative flex flex-1 flex-col overflow-hidden bg-background">
        <div className="min-h-0 flex-1 overflow-y-auto p-4 pt-20 sm:p-6 sm:pt-24 md:p-8">
          <div className="mb-8 flex items-center justify-between border-b border-line pb-4">
            <div>
              <span className="block font-mono text-[10px] font-bold uppercase tracking-widest text-muted">
                OPTIQ MUSIC
              </span>
              <h2 className="mt-1 text-[18px] font-bold tracking-tight text-foreground">All Tracks</h2>
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
            freshIds={freshIds}
            onDelete={deleteTrack}
            onReuse={(id, e) => void handleReuse(id, e)}
            emptyTitle="No tracks yet"
            emptyHint="Describe a mood or scene below and generate your first score."
          />
        </div>

        {error && (
          <div className="mx-4 mb-3 flex animate-rise items-center justify-between rounded-2xl border border-danger bg-danger-soft p-4 text-xs text-danger sm:mx-8">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-muted hover:text-foreground">
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
          generateLabel={`Compose · ${musicCost}`}
          busyLabel="Composing…"
          maxLength={MAX_CHARS}
          hint={`~${trackSeconds}s instrumental`}
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
                className="shrink-0 rounded-full border border-line bg-background px-3 py-1.5 text-[11px] font-semibold text-ink-2"
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
        cost={musicCost}
        balance={balance}
        title="Confirm Optiq Music"
        description={`Original instrumental score (~${trackSeconds}s)`}
        actionLabel="Compose Track"
      />
    </div>
  );
}
