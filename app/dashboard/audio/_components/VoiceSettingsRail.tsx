"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle, DollarSign, Loader2, Settings, UploadCloud, Volume2, VolumeX } from "lucide-react";
import { EngineMode, VOICES, VoiceSample } from "./types";

/**
 * Speaker preview per voice profile. Plays a pre-generated sample from
 * /media/voice-samples/{voiceId}.mp3 (generate once with the TTS pipeline and
 * commit to public/). Shows a muted state if the sample file isn't there yet.
 */
function VoiceSampleButton({ voiceId }: { voiceId: string }) {
  const [state, setState] = useState<"idle" | "loading" | "playing" | "missing">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (state === "playing") {
      audioRef.current?.pause();
      audioRef.current = null;
      setState("idle");
      return;
    }
    setState("loading");
    const audio = new Audio(`/media/voice-samples/${voiceId}.mp3`);
    audioRef.current = audio;
    audio.onended = () => setState("idle");
    audio.onerror = () => {
      setState("missing");
      setTimeout(() => setState("idle"), 1600);
    };
    audio
      .play()
      .then(() => setState("playing"))
      .catch(() => {
        setState("missing");
        setTimeout(() => setState("idle"), 1600);
      });
  };

  return (
    <button
      onClick={toggle}
      title={state === "missing" ? "Sample not available yet" : "Play voice sample"}
      className={`mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
        state === "playing"
          ? "border-blue-500 bg-blue-600/20 text-blue-400"
          : state === "missing"
          ? "border-red-500/30 bg-red-950/30 text-red-400"
          : "border-white/10 bg-white/5 text-neutral-500 hover:text-white hover:bg-white/10"
      }`}
    >
      {state === "loading" ? (
        <Loader2 size={10} className="animate-spin" />
      ) : state === "missing" ? (
        <VolumeX size={10} />
      ) : (
        <Volume2 size={10} />
      )}
    </button>
  );
}

interface VoiceSettingsRailProps {
  engine: EngineMode;
  setEngine: (v: EngineMode) => void;
  voice: string;
  setVoice: (v: string) => void;
  voiceFile: VoiceSample | null;
  clearVoiceFile: () => void;
  attachVoiceFile: (file: File) => void;
  style: string;
  setStyle: (v: string) => void;
  setError: (v: string | null) => void;
  credits: number | null;
}

export default function VoiceSettingsRail({
  engine,
  setEngine,
  voice,
  setVoice,
  voiceFile,
  clearVoiceFile,
  attachVoiceFile,
  style,
  setStyle,
  setError,
  credits,
}: VoiceSettingsRailProps) {
  // Drag and drop state for the cloning sample zone (local to this rail)
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

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

  const handleVoiceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) attachVoiceFile(file);
  };

  return (
    // Full width and stacked above the canvas on phones; a fixed rail from sm up.
    <aside className="w-full sm:w-72 shrink-0 space-y-6 overflow-y-auto border-b sm:border-b-0 sm:border-r border-neutral-900 p-5 pt-20 sm:pt-5 bg-background flex flex-col justify-between">
      <div className="space-y-6 pt-16">
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-[11px] font-bold font-mono text-neutral-500 hover:text-white transition-colors uppercase tracking-wider mb-2 group w-fit"
        >
          <ArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to Dashboard
        </Link>

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
              className={`py-1.5 text-xs font-semibold rounded-lg transition-all border ${
                engine === "prebuilt"
                  ? "bg-[#0c152d] border-blue-500 text-white"
                  : "border-transparent text-neutral-500 hover:text-neutral-200"
              }`}
            >
              Prebuilt Profiles
            </button>
            <button
              onClick={() => {
                setEngine("clone");
                setError(null);
              }}
              className={`py-1.5 text-xs font-semibold rounded-lg transition-all border ${
                engine === "clone"
                  ? "bg-[#0c152d] border-blue-500 text-white"
                  : "border-transparent text-neutral-500 hover:text-neutral-200"
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
                <div
                  key={v.id}
                  className={`flex w-full items-center gap-1 rounded-xl border transition-all duration-300 ${
                    voice === v.id
                      ? "border-blue-500 bg-[#0c152d]"
                      : "border-transparent bg-transparent hover:border-white/5 hover:bg-[#131d35]"
                  }`}
                >
                  <button onClick={() => setVoice(v.id)} className="min-w-0 flex-1 px-3 py-2 text-left">
                    <p className="text-xs font-bold text-white">{v.label}</p>
                    <p className="text-[10px] text-neutral-500 truncate mt-0.5">{v.vibe}</p>
                  </button>
                  <VoiceSampleButton voiceId={v.id} />
                </div>
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
                  ? "border-neutral-800 bg-surface"
                  : "border-neutral-800 hover:border-neutral-700 bg-neutral-950"
              }`}
            >
              {voiceFile ? (
                <div className="space-y-2">
                  <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                    <CheckCircle size={16} />
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-white truncate max-w-[180px] mx-auto">{voiceFile.name}</p>
                    <p className="text-[9px] text-neutral-500 font-mono mt-0.5">Sample loaded successfully</p>
                  </div>

                  <button
                    onClick={clearVoiceFile}
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
                  <span className="text-[9px] text-neutral-600 font-mono">WAV / MP3 · 6-15 seconds max</span>
                  <input type="file" accept="audio/*" onChange={handleVoiceUpload} className="hidden" />
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
            className="w-full rounded-xl border border-neutral-900 bg-surface px-3.5 py-2.5 text-xs placeholder:text-neutral-600 focus:border-neutral-700"
          />
        </div>
      </div>

      {/* Wallet Balance Guide */}
      <div className="border-t border-neutral-900 pt-4 mt-auto">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign size={13} className="text-neutral-400" />
          <span className="text-[10px] font-bold font-mono text-neutral-400 uppercase tracking-wider">
            Wallet Balance Guide
          </span>
        </div>

        <div className="bg-background rounded-xl p-3 border border-neutral-900 text-[10px] space-y-2">
          <p className="text-neutral-500 font-sans leading-relaxed">
            Your wallet balance is consumed on a flat-rate per-action basis:
          </p>
          <div className="space-y-1 font-mono text-[9px] text-neutral-400 border-t border-neutral-900 pt-2">
            <div className="flex justify-between">
              <span>Direct Audio Synth:</span>
              <span className="text-white font-semibold">GMD 100.00</span>
            </div>
            <div className="flex justify-between">
              <span>AI Custom Cloning:</span>
              <span className="text-white font-semibold">GMD 100.00</span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-900 bg-surface/40 px-3 py-2 mt-3 text-[10px] text-neutral-400 font-mono flex justify-between items-center">
          <span>
            Synth Cost: <strong className="text-white font-semibold">GMD 100.00</strong>
          </span>
          <span>
            Balance: <strong className="text-neutral-200">{credits !== null ? `GMD ${credits.toLocaleString()}` : "—"}</strong>
          </span>
        </div>
      </div>
    </aside>
  );
}
