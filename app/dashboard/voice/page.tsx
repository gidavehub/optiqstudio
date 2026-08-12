"use client";

// Optiq Voice Engine — on the bold studio shell, like Video and Image. The
// speaker list is the rail (16 faces, big enough to actually choose from), the
// wall holds every take, and the dock carries Preview / Dictate / Polish / Clear
// over a single script box. No voice cloning — the prebuilt speakers are the
// whole engine.

import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../components/AuthProvider";
import ConfirmGenerationModal from "../../../components/ConfirmGenerationModal";
import VoiceRail, { useSamplePlayer } from "../_shared/audio/VoiceRail";
import AudioProjectsGrid from "../_shared/AudioProjectsGrid";
import StudioShell from "../_shell/StudioShell";
import StudioDock from "../_shell/StudioDock";
import { RailStat } from "../_shell/StudioRail";
import { STUDIO_NAV } from "../_shell/nav";
import { useDictation } from "../_shared/useDictation";
import { useGenerationHistory } from "../_shared/useGenerationHistory";
import { useReusePrompt } from "../_shared/useReusePrompt";
import { VOICE_PROFILES } from "../_shared/audio/voiceProfiles";
import { AudioItem } from "../_shared/audio/types";

const MAX_CHARS = 4000;

export default function VoiceEngineStudio() {
  const { apiFetch, profile, pricing } = useAuth();

  const [selectedId, setSelectedId] = useState(VOICE_PROFILES[0].id);
  const [script, setScript] = useState("");
  const [busy, setBusy] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [openedMenuId, setOpenedMenuId] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const reusePrompt = useReusePrompt();
  const dictation = useDictation(setScript);
  // One player, shared by the rail's per-speaker buttons and the dock's
  // Preview tile — otherwise two samples can play over each other.
  const player = useSamplePlayer();

  const selected = VOICE_PROFILES.find((p) => p.id === selectedId) ?? VOICE_PROFILES[0];

  // Voice is billed per CHARACTER of script (with a floor), mirroring what
  // functions/index.js actually charges.
  const perChar = pricing?.costs.ttsPerCharacter ?? 0.05;
  const minCost = pricing?.costs.ttsMinimum ?? 5;
  const cost = Math.max(minCost, Math.ceil(script.length * perChar));
  const balance = profile?.credits ?? 0;

  const fetchTakes = useCallback(
    () => apiFetch<{ items: AudioItem[] }>("/api/generations?type=audio").then((d) => d.items || []),
    [apiFetch]
  );
  const { history, freshIds, addOptimistic, resolveOptimistic, removeItem } =
    useGenerationHistory<AudioItem>({ fetcher: fetchTakes });

  useEffect(() => {
    const close = () => setOpenedMenuId(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  const triggerGenerate = () => {
    if (!script.trim() || busy) return;
    setConfirmOpen(true);
  };

  // Reads the script back as a narration script rather than as a shot list —
  // same endpoint, different director behind it.
  const polish = async () => {
    if (!script.trim() || polishing) return;
    setPolishing(true);
    setError(null);
    try {
      const data = await apiFetch<{ prompt: string }>("/api/enhance", {
        method: "POST",
        body: JSON.stringify({ prompt: script, kind: "voice" }),
      });
      setScript(data.prompt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Polish failed");
    } finally {
      setPolishing(false);
    }
  };

  const handleGenerate = async () => {
    if (!script.trim() || busy) return;
    setBusy(true);
    setError(null);

    const tempId = `temp_${Date.now()}`;
    const original = script;
    addOptimistic({
      id: tempId,
      status: "queued",
      prompt: original,
      audioUrl: null,
      createdAt: new Date().toISOString(),
    } as AudioItem);
    setScript("");

    try {
      const data = await apiFetch<{ id: string; url: string }>("/api/voice/generate", {
        method: "POST",
        body: JSON.stringify({ text: original, voice: selected.voice }),
      });
      resolveOptimistic(tempId, {
        id: data.id,
        status: "succeeded",
        audioUrl: data.url,
      } as Partial<AudioItem>);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Voice synthesis failed");
      removeItem(tempId);
    } finally {
      setBusy(false);
    }
  };

  const handleReuse = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenedMenuId(null);
    const reused = await reusePrompt(id);
    if (reused) setScript(reused.prompt);
  };

  const deleteTake = (id: string, e: React.MouseEvent) => {
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

  const previewing = player.playingId === selected.id;

  return (
    <StudioShell
      navItems={STUDIO_NAV}
      activeId="voice"
      title="All takes"
      railLabel="Speakers"
      rail={
        <>
          <RailStat
            label="Reading now"
            value={selected.name}
            note={`${selected.accent} · GMD ${cost} for this script`}
          />
          <VoiceRail selectedId={selectedId} onSelect={setSelectedId} player={player} />
        </>
      }
      dock={({ openRail }) => (
        <StudioDock
          tiles={[
            {
              id: "speaker",
              label: "Speaker",
              icon: "user",
              value: selected.name,
              onSelect: openRail,
            },
            {
              id: "preview",
              label: previewing ? "Stop" : "Preview",
              icon: previewing ? "pause" : "play",
              busy: player.loadingId === selected.id,
              active: previewing,
              onSelect: () => player.toggle(selected.id),
            },
            {
              id: "dictate",
              label: dictation.recording ? "Stop" : "Dictate",
              icon: dictation.recording ? "micOff" : "voice",
              danger: dictation.recording,
              onSelect: dictation.toggle,
            },
            {
              id: "polish",
              label: "Polish",
              icon: "enhance",
              busy: polishing,
              disabled: !script.trim() || polishing,
              onSelect: () => void polish(),
            },
          ]}
          value={dictation.recording && dictation.interim ? `${script} ${dictation.interim}`.trim() : script}
          setValue={setScript}
          readOnly={dictation.recording}
          placeholder={
            dictation.recording ? "Listening…" : `Write ${selected.name}'s narration script…`
          }
          onSubmit={triggerGenerate}
          busy={busy}
          maxLength={MAX_CHARS}
          hint={`GMD ${cost} · ${selected.name}`}
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
        variant="voice"
        openedMenuId={openedMenuId}
        setOpenedMenuId={setOpenedMenuId}
        deletingIds={deletingIds}
        freshIds={freshIds}
        onDelete={deleteTake}
        onReuse={(id, e) => void handleReuse(id, e)}
        emptyTitle="No takes yet"
        emptyHint="Pick a speaker, write a script below, and your takes land here."
      />

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
    </StudioShell>
  );
}
