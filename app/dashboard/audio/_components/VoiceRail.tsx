"use client";

// VoiceRail — the Optiq Voice Engine speaker picker. A face + name + accent per
// profile, grouped by region, each with a sample-play button that plays the
// pre-generated clip from /media/voice-samples/<id>.wav. Desktop rail; the
// voice page renders its own compact face strip on mobile.

import React, { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Pause, Play } from "lucide-react";
import { VOICE_PROFILES, VOICE_REGIONS, VoiceProfile } from "./voiceProfiles";

// /media/* is served with an immutable 1-year cache (see next.config.ts), so a
// regenerated sample keeps its filename but must change its URL to be re-fetched.
// Bump this whenever the sample clips are regenerated.
const SAMPLE_VERSION = 2;

function useSamplePlayer() {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggle = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (playingId === id) {
      setPlayingId(null);
      return;
    }
    setLoadingId(id);
    const audio = new Audio(`/media/voice-samples/${id}.wav?v=${SAMPLE_VERSION}`);
    audioRef.current = audio;
    audio.onended = () => setPlayingId(null);
    audio.onerror = () => {
      setLoadingId(null);
      setPlayingId(null);
    };
    void audio
      .play()
      .then(() => {
        setLoadingId(null);
        setPlayingId(id);
      })
      .catch(() => {
        setLoadingId(null);
        setPlayingId(null);
      });
  };

  return { playingId, loadingId, toggle };
}

function SpeakerRow({
  p,
  selected,
  onSelect,
  playing,
  loading,
  onToggleSample,
}: {
  p: VoiceProfile;
  selected: boolean;
  onSelect: () => void;
  playing: boolean;
  loading: boolean;
  onToggleSample: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      className={`flex w-full items-center gap-2 rounded-xl border p-1.5 transition-all duration-300 ${
        selected ? "border-blue-500 bg-[#0c152d]" : "border-transparent hover:border-white/5 hover:bg-[#131d35]"
      }`}
    >
      <button onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
        <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-neutral-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/media/voice-faces/${p.id}.jpg`} alt={p.name} className="h-full w-full object-cover" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-xs font-bold text-white">{p.name}</span>
          <span className="block truncate text-[10px] text-neutral-500">{p.accent}</span>
        </span>
      </button>
      <button
        onClick={onToggleSample}
        title="Play sample"
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors ${
          playing
            ? "border-blue-500 bg-blue-600/20 text-blue-400"
            : "border-white/10 bg-white/5 text-neutral-400 hover:bg-white/10 hover:text-white"
        }`}
      >
        {loading ? (
          <Loader2 size={11} className="animate-spin" />
        ) : playing ? (
          <Pause size={11} />
        ) : (
          <Play size={11} className="translate-x-[1px]" />
        )}
      </button>
    </div>
  );
}

interface VoiceRailProps {
  selectedId: string;
  onSelect: (id: string) => void;
}

export default function VoiceRail({ selectedId, onSelect }: VoiceRailProps) {
  const { playingId, loadingId, toggle } = useSamplePlayer();

  return (
    <aside className="hidden w-full shrink-0 space-y-6 overflow-y-auto border-b border-neutral-900 bg-background p-5 sm:block sm:w-72 sm:border-b-0 sm:border-r sm:pt-24">
      <Link
        href="/dashboard/audio"
        className="group flex w-fit items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-neutral-500 transition-colors hover:text-white"
      >
        <ArrowLeft size={12} className="transition-transform group-hover:-translate-x-0.5" />
        Back
      </Link>

      <div>
        <p className="eyebrow mb-3">Speaker</p>
        <div className="space-y-4">
          {VOICE_REGIONS.map((region) => {
            const group = VOICE_PROFILES.filter((p) => p.region === region);
            if (group.length === 0) return null;
            return (
              <div key={region}>
                <p className="mb-1.5 px-1 font-mono text-[9px] uppercase tracking-widest text-neutral-600">{region}</p>
                <div className="space-y-1">
                  {group.map((p) => (
                    <SpeakerRow
                      key={p.id}
                      p={p}
                      selected={selectedId === p.id}
                      onSelect={() => onSelect(p.id)}
                      playing={playingId === p.id}
                      loading={loadingId === p.id}
                      onToggleSample={(e) => toggle(p.id, e)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
