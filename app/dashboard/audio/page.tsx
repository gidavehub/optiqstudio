"use client";

// Voice Studio — thin page shell. State, API handlers, and cloning polls live
// here; UI panels are split into ./_components (VoiceSettingsRail,
// CustomAudioPlayer, TakesLibrary).

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mic, Plus } from "lucide-react";
import { useAuth } from "../../../components/AuthProvider";
import ConfirmGenerationModal from "../../../components/ConfirmGenerationModal";
import AssetPickerModal from "../../../components/AssetPickerModal";
import VoiceSettingsRail from "./_components/VoiceSettingsRail";
import CustomAudioPlayer from "./_components/CustomAudioPlayer";
import TakesLibrary from "./_components/TakesLibrary";
import { AudioItem, EngineMode, VOICES, VoiceSample } from "./_components/types";

export default function VoiceStudio() {
  const { apiFetch, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const [text, setText] = useState("");
  const [engine, setEngine] = useState<EngineMode>("prebuilt");

  // Custom cloning states
  const [voiceFile, setVoiceFile] = useState<VoiceSample | null>(null);

  const [voice, setVoice] = useState("Kore");
  const [style, setStyle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<AudioItem[]>([]);
  const [activeItem, setActiveItem] = useState<AudioItem | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);

  const pollRefs = useRef<{ [key: string]: ReturnType<typeof setInterval> }>({});

  // Flat-rate GMD 100.00 as specified
  const cost = 100;

  const loadHistory = useCallback(() => {
    apiFetch<{ items: AudioItem[] }>("/api/generations?type=audio")
      .then((d) => setHistory(d.items))
      .catch(() => {});
  }, [apiFetch]);

  useEffect(() => {
    loadHistory();
    const activePolls = pollRefs.current;
    return () => {
      // Cleanup all active polling intervals on unmount
      Object.values(activePolls).forEach((interval) => clearInterval(interval));
    };
  }, [loadHistory]);

  // Handle active background poll resuming
  useEffect(() => {
    history.forEach((item) => {
      if (item.status === "queued" && !pollRefs.current[item.id] && !item.id.startsWith("temp_")) {
        startSingleCloningPoll(item.id, item.prompt);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history]);

  const attachVoiceFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      setVoiceFile({ base64, mimeType: file.type, preview: dataUrl, name: file.name });
    };
    reader.readAsDataURL(file);
  };

  const triggerGenerate = () => {
    if (!text.trim() || busy) return;
    if (engine === "clone" && !voiceFile) {
      setError("Please upload a 6-15s voice sample for cloning first");
      return;
    }
    setConfirmOpen(true);
  };

  // Background status checker for Custom AI Cloned jobs
  const startSingleCloningPoll = (id: string, initialPrompt: string) => {
    if (pollRefs.current[id]) clearInterval(pollRefs.current[id]);

    pollRefs.current[id] = setInterval(async () => {
      try {
        const status = await apiFetch<{
          status: string;
          audioUrl?: string;
          error?: string;
        }>(`/api/video/status?id=${id}`);

        if (status.status === "succeeded") {
          clearInterval(pollRefs.current[id]);
          delete pollRefs.current[id];

          loadHistory();
          void refreshProfile();

          setHistory((prev) =>
            prev.map((item) =>
              item.id === id ? { ...item, status: "succeeded", audioUrl: status.audioUrl ?? null } : item
            )
          );

          if (status.audioUrl) {
            setResultUrl(status.audioUrl);
            setActiveItem({
              id,
              prompt: initialPrompt,
              audioUrl: status.audioUrl,
              status: "succeeded",
              createdAt: new Date().toISOString(),
            });
          }
        } else if (status.status === "failed") {
          clearInterval(pollRefs.current[id]);
          delete pollRefs.current[id];

          loadHistory();
          void refreshProfile();

          setHistory((prev) =>
            prev.map((item) => (item.id === id ? { ...item, status: "failed", error: status.error } : item))
          );
        }
      } catch {
        // Ignore network glitches
      }
    }, 4000);
  };

  const generate = async () => {
    if (!text.trim() || busy) return;
    setBusy(true);
    setError(null);

    // Asynchronous Voice Cloning pipeline
    if (engine === "clone" && voiceFile) {
      const tempId = `temp_${Date.now()}`;
      const tempItem: AudioItem = {
        id: tempId,
        status: "queued",
        prompt: text,
        audioUrl: null,
        createdAt: new Date().toISOString(),
      };

      setHistory((prev) => [tempItem, ...prev]);
      const originalText = text;
      setText(""); // Instant terminal clear for optimized UX

      try {
        const d = await apiFetch<{ id: string }>("/api/voice/generate", {
          method: "POST",
          body: JSON.stringify({
            text: originalText,
            voiceBase64: voiceFile.base64,
            voiceMimeType: voiceFile.mimeType,
          }),
        });

        // Replace local skeleton with real Firestore document ID
        setHistory((prev) =>
          prev.map((item) => (item.id === tempId ? { ...item, id: d.id, status: "queued" } : item))
        );

        // Spin up background status tracker
        startSingleCloningPoll(d.id, originalText);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Voice cloning failed");
        setHistory((prev) => prev.filter((item) => item.id !== tempId));
      } finally {
        setBusy(false);
      }
      return;
    }

    // Synchronous Prebuilt Local Profiles pipeline
    try {
      const data = await apiFetch<{ url: string }>("/api/voice/generate", {
        method: "POST",
        body: JSON.stringify({ text, voice, style: style || undefined }),
      });
      setResultUrl(data.url);
      loadHistory();
      void refreshProfile();

      const newItem: AudioItem = {
        id: `local_${Date.now()}`,
        status: "succeeded",
        prompt: text,
        audioUrl: data.url,
        createdAt: new Date().toISOString(),
      };
      setActiveItem(newItem);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Synthesis failed");
    } finally {
      setBusy(false);
    }
  };

  // Delete an audio take via API
  const deleteTake = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (pollRefs.current[id]) {
        clearInterval(pollRefs.current[id]);
        delete pollRefs.current[id];
      }
      await apiFetch(`/api/generations?id=${id}`, {
        method: "DELETE",
      });
      setHistory((prev) => prev.filter((item) => item.id !== id));
      if (activeItem?.id === id) {
        setActiveItem(null);
        setResultUrl(null);
      }
      void refreshProfile();
    } catch {
      // Optimistic delete
      if (pollRefs.current[id]) {
        clearInterval(pollRefs.current[id]);
        delete pollRefs.current[id];
      }
      setHistory((prev) => prev.filter((item) => item.id !== id));
      if (activeItem?.id === id) {
        setActiveItem(null);
        setResultUrl(null);
      }
    }
  };

  const selectTake = (item: AudioItem) => {
    if (item.audioUrl) {
      setResultUrl(item.audioUrl);
      setActiveItem(item);
    }
  };

  return (
    <div className="flex h-full bg-black text-white">
      {/* Settings Panel & WorkSpace configuration */}
      <VoiceSettingsRail
        engine={engine}
        setEngine={setEngine}
        voice={voice}
        setVoice={setVoice}
        voiceFile={voiceFile}
        clearVoiceFile={() => setVoiceFile(null)}
        attachVoiceFile={attachVoiceFile}
        style={style}
        setStyle={setStyle}
        setError={setError}
        credits={profile ? profile.credits : null}
      />

      {/* Creative workspace viewport */}
      <main className="flex-1 flex flex-col overflow-hidden bg-black relative">
        <div className="flex-1 overflow-y-auto p-6 md:p-8 pt-24">
          {/* Header section */}
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-neutral-900">
            <div>
              <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase tracking-widest block">
                CREATIVE FLOW
              </span>
              <h2 className="text-[18px] font-bold tracking-tight text-white mt-1">
                {engine === "clone" ? "AI Voice Cloning Workspace" : "Studio Voiceover Terminal"}
              </h2>
            </div>

            <button
              onClick={() => setAssetPickerOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-neutral-800 bg-surface/80 hover:bg-neutral-800 text-xs font-semibold text-neutral-300 hover:text-white transition-all shadow-md"
            >
              <Plus size={13} />
              Asset Composer
            </button>
          </div>

          <div className="space-y-6">
            {/* Terminal text area script editor */}
            <div className="relative">
              <textarea
                rows={6}
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={4000}
                placeholder="Paste or write your premium narration script here…"
                className="w-full resize-none rounded-2xl border border-neutral-800 bg-surface/60 p-4 text-sm placeholder:text-neutral-600 focus:border-neutral-700 leading-relaxed transition-all"
              />
              <div className="mt-1 flex justify-between text-[10px] font-mono text-neutral-500">
                <span>{text.length.toLocaleString()} / 4,000 characters</span>
                <span>GMD {cost}.00 estimate</span>
              </div>
            </div>

            {/* Synthesize triggering controls */}
            <div className="flex justify-start">
              <button
                onClick={triggerGenerate}
                disabled={busy || !text.trim()}
                className="flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-xs font-bold text-black hover:bg-neutral-200 transition-all disabled:opacity-40 active:scale-98 shadow-md"
              >
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Mic size={13} />}
                {busy ? "Synthesizing Stream…" : `Synthesize Voiceover · ${cost}`}
              </button>
            </div>

            {/* Error notifications */}
            {error && (
              <p className="rounded-xl border border-red-950 bg-red-950/20 px-4 py-3 text-xs text-red-300 animate-rise border-red-900/40">
                {error}
              </p>
            )}

            {/* Premium custom Take Monitor player */}
            {resultUrl && (
              <div className="space-y-2 animate-rise">
                <p className="text-[10px] font-mono font-bold text-neutral-500 uppercase tracking-widest">
                  TAKE MONITOR PLAYER
                </p>
                <CustomAudioPlayer src={resultUrl} />
              </div>
            )}

            {/* Previous takes library — takes open their dedicated detail route */}
            <TakesLibrary
              history={history}
              activeItem={activeItem}
              onSelect={(item) => {
                if (!item.id.startsWith("temp_") && !item.id.startsWith("local_")) {
                  router.push(`/dashboard/audio/${item.id}`);
                } else {
                  selectTake(item);
                }
              }}
              onDelete={(id, e) => void deleteTake(id, e)}
            />
          </div>
        </div>
      </main>

      <ConfirmGenerationModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={generate}
        cost={cost}
        balance={profile?.credits ?? 0}
        title={engine === "clone" ? "Confirm AI Custom Cloning" : "Confirm Voice Synthesis"}
        description={
          engine === "clone"
            ? `You are about to run our advanced AI voice cloner using your custom voice sample. This GPU operation flat-rates at GMD ${cost.toFixed(2)}.`
            : `You are about to synthesize a take using the selected localized prebuilt profile. This will deduct GMD ${cost.toFixed(2)} from your wallet balance.`
        }
        actionLabel={engine === "clone" ? "Clone Custom Voice" : "Synthesize Voice"}
      />

      {/* Asset Picker Modal */}
      <AssetPickerModal
        isOpen={assetPickerOpen}
        onClose={() => setAssetPickerOpen(false)}
        onSelectCharacter={(character) => {
          setText((prev) => {
            const greeting = `[Actor: ${character.name}] hello! I am ready to read this script.`;
            return prev ? `${prev}\n${greeting}` : greeting;
          });

          if (character.voiceUrl) {
            setEngine("clone");
            setError(null);
            fetch(character.voiceUrl)
              .then((res) => res.blob())
              .then((blob) => {
                const reader = new FileReader();
                reader.onload = () => {
                  const dataUrl = reader.result as string;
                  setVoiceFile({
                    base64: dataUrl.split(",")[1],
                    mimeType: blob.type || "audio/wav",
                    preview: dataUrl,
                    name: `${character.name}_voice.wav`,
                  });
                };
                reader.readAsDataURL(blob);
              })
              .catch(() => {
                setError("Failed to convert character voice for cloning reference");
              });
          } else if (character.voiceType === "synthesize") {
            setEngine("prebuilt");
            const matchingVoice = VOICES.find(
              (v) =>
                v.id.toLowerCase() === character.voiceDescription?.toLowerCase() ||
                v.label.toLowerCase().includes(character.voiceDescription?.toLowerCase() || "")
            );
            if (matchingVoice) {
              setVoice(matchingVoice.id);
            }
          }
        }}
        onSelectTrait={(trait) => {
          setStyle((prev) => (prev ? `${prev}, ${trait}` : trait));
        }}
        onUploadFile={(file) => {
          attachVoiceFile(file);
        }}
        allowedUploadTypes="audio/*"
      />
    </div>
  );
}
