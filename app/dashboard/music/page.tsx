"use client";

// Optiq Music — the score studio, on the bold studio shell.
//
// The thing that makes this studio different from the other three is the
// DIRECTOR. Everywhere else the user knows what they want and is describing it;
// here they usually know the scene and not the score. So Music gets an agent:
// write the scene, press Direct, and three fully-formed directions come back —
// genre, tempo, key, instrumentation, and a Lyria-ready brief each. Picking one
// loads its brief; Compose generates it. The director is free; only the
// generation charges, same as everywhere else.

import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../components/AuthProvider";
import ConfirmGenerationModal from "../../../components/ConfirmGenerationModal";
import AudioProjectsGrid from "../_shared/AudioProjectsGrid";
import StudioShell from "../_shell/StudioShell";
import StudioDock from "../_shell/StudioDock";
import { RailGroup, RailChips } from "../_shell/StudioRail";
import { STUDIO_NAV } from "../_shell/nav";
import MusicDirections, { MusicDirection } from "./_components/MusicDirections";
import { useDictation } from "../_shared/useDictation";
import { useGenerationHistory } from "../_shared/useGenerationHistory";
import { useReusePrompt } from "../_shared/useReusePrompt";
import { AudioItem } from "../_shared/audio/types";

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

  // The director's state. `activeDirection` is which one is loaded in the box,
  // so the rail can show which card the current brief came from.
  const [directions, setDirections] = useState<MusicDirection[]>([]);
  const [directing, setDirecting] = useState(false);
  const [activeDirection, setActiveDirection] = useState<string | null>(null);

  const reusePrompt = useReusePrompt();
  const dictation = useDictation(setPrompt);
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

  const addMood = (mood: string) =>
    setPrompt((prev) => (prev.trim() ? `${prev.trim()}, ${mood.toLowerCase()}` : mood));

  // ── The director ────────────────────────────────────────────────────────
  const direct = async () => {
    if (!prompt.trim() || directing) return;
    setDirecting(true);
    setError(null);
    try {
      const data = await apiFetch<{ directions: MusicDirection[] }>("/api/music/direct", {
        method: "POST",
        body: JSON.stringify({ idea: prompt }),
      });
      setDirections(data.directions || []);
      setActiveDirection(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The director couldn't answer that");
    } finally {
      setDirecting(false);
    }
  };

  const useDirection = (d: MusicDirection) => {
    setPrompt(d.brief);
    setActiveDirection(d.name);
  };

  const handleEnhance = async () => {
    if (!prompt.trim() || enhancing) return;
    setEnhancing(true);
    setError(null);
    try {
      const data = await apiFetch<{ prompt: string }>("/api/enhance", {
        method: "POST",
        body: JSON.stringify({ prompt, kind: "music" }),
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
    setActiveDirection(null);

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
    <StudioShell
      navItems={STUDIO_NAV}
      activeId="music"
      title="All tracks"
      railLabel="Direction"
      rail={
        <>
          <RailGroup title="Directions" hint="Free · pick one">
            <MusicDirections
              directions={directions}
              busy={directing}
              activeName={activeDirection}
              onUse={useDirection}
            />
          </RailGroup>

          <RailGroup title="Mood & genre" hint="Tap to add">
            <RailChips options={MOODS} onPick={addMood} />
          </RailGroup>
        </>
      }
      dock={({ openRail }) => (
        <StudioDock
          tiles={[
            {
              id: "direct",
              label: "Direct",
              icon: "agent",
              busy: directing,
              disabled: !prompt.trim() || directing,
              onSelect: () => {
                openRail();
                void direct();
              },
            },
            {
              id: "dictate",
              label: dictation.recording ? "Stop" : "Dictate",
              icon: dictation.recording ? "micOff" : "voice",
              danger: dictation.recording,
              onSelect: dictation.toggle,
            },
            {
              id: "enhance",
              label: "Enhance",
              icon: "enhance",
              busy: enhancing,
              disabled: !prompt.trim() || enhancing,
              onSelect: () => void handleEnhance(),
            },
            {
              id: "moods",
              label: "Moods",
              icon: "waveform",
              badge: directions.length,
              onSelect: openRail,
            },
          ]}
          value={dictation.recording && dictation.interim ? `${prompt} ${dictation.interim}`.trim() : prompt}
          setValue={(v) => {
            setPrompt(v);
            // Once it's been edited it's no longer the director's brief.
            if (activeDirection) setActiveDirection(null);
          }}
          readOnly={dictation.recording}
          placeholder={
            dictation.recording
              ? "Listening…"
              : "A bank advert in Banjul — hopeful, families, morning light…"
          }
          onSubmit={triggerGenerate}
          busy={busy}
          maxLength={MAX_CHARS}
          hint={`GMD ${musicCost} · ~${trackSeconds}s instrumental`}
          error={error}
          onDismissError={() => setError(null)}
        />
      )}
    >
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
        emptyHint="Describe the scene below, then press Direct and pick a sound."
      />

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
    </StudioShell>
  );
}
