"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Download,
  Loader2,
  Mic,
  Play,
  Pause,
  Settings,
  Flame,
  Volume2,
  VolumeX,
  UploadCloud,
  DollarSign,
  Trash2,
  Sparkles,
  ChevronLeft,
  CheckCircle,
  Plus,
} from "lucide-react";
import { useAuth } from "../../../components/AuthProvider";
import ConfirmGenerationModal from "../../../components/ConfirmGenerationModal";
import AssetPickerModal from "../../../components/AssetPickerModal";

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
  status?: string;
  error?: string | null;
  createdAt: string;
}

interface CustomAudioPlayerProps {
  src: string;
}

function CustomAudioPlayer({ src }: CustomAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    setCurrentTime(audioRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!audioRef.current) return;
    setDuration(audioRef.current.duration);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!audioRef.current) return;
    const val = parseFloat(e.target.value);
    audioRef.current.currentTime = val;
    setCurrentTime(val);
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    if (audioRef.current) {
      audioRef.current.load();
    }
  }, [src]);

  return (
    <div className="group relative w-full overflow-hidden rounded-2xl border border-neutral-800 bg-[#0d0d0e]/95 p-4 shadow-xl flex items-center gap-4 backdrop-blur-md">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
      />
      <button
        onClick={togglePlay}
        className="flex h-11 w-10 shrink-0 items-center justify-center rounded-full bg-white text-black hover:bg-neutral-200 transition-all shadow-md active:scale-95"
      >
        {isPlaying ? <Pause size={16} fill="black" /> : <Play size={16} fill="black" className="ml-0.5" />}
      </button>
      
      <div className="flex-1 flex flex-col gap-1">
        <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono">
          <span className="font-semibold text-neutral-200 uppercase tracking-wider text-[9px]">MONITOR PLAYBACK</span>
          <span>{formatTime(currentTime)} / {formatTime(duration)}</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-white hover:h-1.5 transition-all"
            style={{
              background: `linear-gradient(to right, #ffffff ${((currentTime / (duration || 1)) * 100).toFixed(2)}%, rgba(255, 255, 255, 0.2) ${((currentTime / (duration || 1)) * 100).toFixed(2)}%)`
            }}
          />
        </div>
      </div>
      
      <a
        href={src}
        download="optiq_take.wav"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-colors cursor-pointer"
        title="Download WAV Take"
      >
        <Download size={14} />
      </a>
    </div>
  );
}

export default function VoiceStudio() {
  const { apiFetch, profile, pricing, refreshProfile } = useAuth();
  const [text, setText] = useState("");
  const [engine, setEngine] = useState<"prebuilt" | "clone">("prebuilt");
  
  // Custom cloning states
  const [voiceFile, setVoiceFile] = useState<{ base64: string; mimeType: string; preview: string; name: string } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

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

  const per100 = pricing?.costs.ttsPer100Chars ?? 10;
  const minCharge = pricing?.costs.ttsMinimum ?? 15;
  const cost = Math.max(engine === "clone" ? 30 : minCharge, Math.ceil(text.length / 100) * per100);

  const loadHistory = useCallback(() => {
    apiFetch<{ items: AudioItem[] }>("/api/generations?type=audio")
      .then((d) => setHistory(d.items))
      .catch(() => {});
  }, [apiFetch]);

  useEffect(() => {
    loadHistory();
    return () => {
      // Cleanup all active polling intervals on unmount
      Object.values(pollRefs.current).forEach((interval) => clearInterval(interval));
    };
  }, [loadHistory]);

  // Handle active background poll resuming
  useEffect(() => {
    history.forEach((item) => {
      if (item.status === "queued" && !pollRefs.current[item.id] && !item.id.startsWith("temp_")) {
        startSingleCloningPoll(item.id, item.prompt);
      }
    });
  }, [history]);

  const handleVoiceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) attachVoiceFile(file);
  };

  const attachVoiceFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      setVoiceFile({ base64, mimeType: file.type, preview: dataUrl, name: file.name });
    };
    reader.readAsDataURL(file);
  };

  // Drag and drop events for file cloning zone
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (dragCounter.current === 1) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.type.startsWith("audio/") || file.name.endsWith(".wav") || file.name.endsWith(".mp3"))) {
      attachVoiceFile(file);
    }
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
              item.id === id
                ? { ...item, status: "succeeded", audioUrl: status.audioUrl ?? null }
                : item
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
            prev.map((item) =>
              item.id === id
                ? { ...item, status: "failed", error: status.error }
                : item
            )
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
          prev.map((item) =>
            item.id === tempId ? { ...item, id: d.id, status: "queued" } : item
          )
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

  const selectTake = (item: AudioItem) => {
    if (item.audioUrl) {
      setResultUrl(item.audioUrl);
      setActiveItem(item);
    }
  };

  return (
    <div className="flex h-full bg-black text-white">
      
      {/* Settings Panel & WorkSpace configuration */}
      <aside className="w-72 shrink-0 space-y-6 overflow-y-auto border-r border-neutral-900 p-5 bg-[#070707] flex flex-col justify-between">
        <div className="space-y-6">
          <div className="flex items-center gap-2 pb-2 border-b border-neutral-900">
            <Settings size={15} className="text-neutral-400 animate-pulse" />
            <span className="text-xs font-bold font-mono text-neutral-400 uppercase tracking-widest">
              WORKSPACE CONFIG
            </span>
          </div>

          <div>
            <p className="eyebrow mb-2">Engine Mode</p>
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-neutral-950 border border-neutral-900">
              <button
                onClick={() => {
                  setEngine("prebuilt");
                  setError(null);
                }}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  engine === "prebuilt"
                    ? "bg-neutral-800 text-white shadow"
                    : "text-neutral-500 hover:text-white"
                }`}
              >
                Prebuilt Profiles
              </button>
              <button
                onClick={() => {
                  setEngine("clone");
                  setError(null);
                }}
                className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  engine === "clone"
                    ? "bg-neutral-800 text-white shadow"
                    : "text-neutral-500 hover:text-white"
                }`}
              >
                AI Voice Cloning
              </button>
            </div>
          </div>

          {engine === "prebuilt" ? (
            <div>
              <p className="eyebrow mb-2">Voice Profile Picker</p>
              <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1 border border-neutral-950 bg-neutral-950 p-2 rounded-xl border-neutral-900">
                {VOICES.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setVoice(v.id)}
                    className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                      voice === v.id
                        ? "border-white/40 bg-[#161617]"
                        : "border-transparent bg-transparent hover:bg-neutral-900"
                    }`}
                  >
                    <p className="text-xs font-bold text-white">{v.label}</p>
                    <p className="text-[10px] text-neutral-500 truncate mt-0.5">{v.vibe}</p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="eyebrow">Voice Sample (Drag / Click)</p>
              
              <div
                onDragEnter={handleDragEnter}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative rounded-xl border border-dashed p-5 text-center transition-all ${
                  isDragging
                    ? "border-white bg-white/5"
                    : voiceFile
                    ? "border-neutral-800 bg-[#0d0d0e]"
                    : "border-neutral-800 hover:border-neutral-700 bg-neutral-950"
                }`}
              >
                {voiceFile ? (
                  <div className="space-y-2">
                    <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                      <CheckCircle size={16} />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-white truncate max-w-[180px] mx-auto">
                        {voiceFile.name}
                      </p>
                      <p className="text-[9px] text-neutral-500 font-mono mt-0.5">Sample loaded successfully</p>
                    </div>
                    
                    <button
                      onClick={() => setVoiceFile(null)}
                      className="text-[10px] text-red-400 hover:text-red-300 font-medium cursor-pointer"
                    >
                      Reset Sample
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center gap-2 cursor-pointer">
                    <UploadCloud size={24} className="text-neutral-500" />
                    <span className="text-[11px] font-medium text-neutral-400 leading-normal">
                      Drag sample audio file or <span className="text-white hover:underline">browse</span>
                    </span>
                    <span className="text-[9px] text-neutral-600 font-mono">
                      WAV / MP3 · 6-15 seconds max
                    </span>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleVoiceUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          )}

          <div>
            <p className="eyebrow mb-2">Style / Directions</p>
            <input
              value={style}
              onChange={(e) => setStyle(e.target.value)}
              placeholder="Directions (e.g. “slow, movie-trailer gravitas”)"
              className="w-full rounded-xl border border-neutral-900 bg-[#0d0d0e] px-3.5 py-2.5 text-xs placeholder:text-neutral-600 focus:border-neutral-700"
            />
          </div>
        </div>

        {/* Dynamic dynamic billing guide */}
        <div className="border-t border-neutral-900 pt-4 mt-auto">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={13} className="text-neutral-400" />
            <span className="text-[10px] font-bold font-mono text-neutral-400 uppercase tracking-wider">
              BILLING GUIDE
            </span>
          </div>
          
          <div className="bg-[#050506] rounded-xl p-3 border border-neutral-900 text-[10px] space-y-2">
            <p className="text-neutral-500 font-sans leading-relaxed">
              Synthesize and clone premium narration using specialized deep synthesis:
            </p>
            <div className="space-y-1 font-mono text-[9px] text-neutral-400 border-t border-neutral-900 pt-2">
              <div className="flex justify-between">
                <span>Prebuilt Voiceover:</span>
                <span className="text-white font-semibold">10 cr / 100 chars</span>
              </div>
              <div className="flex justify-between">
                <span>AI Custom Cloning:</span>
                <span className="text-white font-semibold">30 cr flat-rate</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-neutral-900 bg-[#0d0d0e]/40 px-3 py-2 mt-3 text-[10px] text-neutral-400 font-mono flex justify-between items-center">
            <span>Cost: <strong className="text-white font-semibold">{cost} cr</strong></span>
            <span>Balance: <strong className="text-neutral-200">{profile ? profile.credits.toLocaleString() : "—"}</strong></span>
          </div>
        </div>
      </aside>

      {/* Creative workspace viewport */}
      <main className="flex-1 flex flex-col overflow-hidden bg-black relative">
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          
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
              className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-neutral-800 bg-[#0d0d0e]/80 hover:bg-neutral-800 text-xs font-semibold text-neutral-300 hover:text-white transition-all shadow-md"
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
                className="w-full resize-none rounded-2xl border border-neutral-800 bg-[#0d0d0e]/60 p-4 text-sm placeholder:text-neutral-600 focus:border-neutral-700 leading-relaxed transition-all"
              />
              <div className="mt-1 flex justify-between text-[10px] font-mono text-neutral-500">
                <span>{text.length.toLocaleString()} / 4,000 characters</span>
                <span>{cost} credits estimate</span>
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

            {/* Previous takes library */}
            <div className="pt-4 border-t border-neutral-900">
              <div className="flex justify-between items-center mb-4">
                <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase tracking-widest">
                  Takes Library History
                </span>
                <span className="text-[9px] font-mono text-neutral-600">Showing recent 12 takes</span>
              </div>

              {history.length === 0 ? (
                <div className="rounded-2xl border border-neutral-900 p-8 text-center bg-neutral-950/20">
                  <VolumeX size={20} className="text-neutral-700 mx-auto mb-2" />
                  <p className="text-xs text-neutral-500 font-sans">No previous voiceover takes found.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {history.slice(0, 12).map((h) => {
                    const isRendering = h.status === "queued";
                    const isActive = activeItem?.id === h.id;
                    return (
                      <div
                        key={h.id}
                        onClick={() => !isRendering && selectTake(h)}
                        className={`group relative rounded-xl border px-3.5 py-3 text-left transition-all backdrop-blur ${
                          isRendering
                            ? "border-dashed border-neutral-800 bg-[#080809]/40 cursor-wait"
                            : isActive
                            ? "border-white/30 bg-[#161617]"
                            : "border-neutral-900 hover:border-neutral-800 bg-[#0c0c0d]/60 cursor-pointer"
                        }`}
                      >
                        {isRendering ? (
                          <div className="flex items-center gap-3">
                            <Loader2 size={13} className="animate-spin text-neutral-400 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <span className="text-[10px] font-mono font-bold text-neutral-400 block uppercase tracking-wider">
                                SYNTHESIZING CUSTOM VOICE...
                              </span>
                              <p className="text-[9px] text-neutral-600 truncate mt-0.5">
                                Modal GPU worker is rendering your take.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-900 border border-neutral-800 group-hover:bg-white group-hover:text-black transition-colors">
                              <Play size={10} fill="currentColor" className="ml-0.5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-mono font-bold text-neutral-400 block uppercase tracking-widest">
                                  {h.id.startsWith("voice_") ? "AI CLONED TAKE" : "PREBUILT SPEAKER"}
                                </span>
                                <span className="text-[9px] text-neutral-600 font-mono">
                                  {new Date(h.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                              <p className="text-[11px] text-neutral-300 truncate mt-0.5 italic leading-relaxed">
                                &ldquo;{h.prompt}&rdquo;
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
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
            ? `You are about to run our advanced AI voice cloner using your custom voice sample. This GPU operation flat-rates at ${cost} credits.`
            : `You are about to synthesize a take using the selected localized prebuilt profile. This will deduct ${cost} credits from your ledger.`
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
            const matchingVoice = VOICES.find((v) => v.id.toLowerCase() === character.voiceDescription?.toLowerCase() || v.label.toLowerCase().includes(character.voiceDescription?.toLowerCase() || ""));
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
