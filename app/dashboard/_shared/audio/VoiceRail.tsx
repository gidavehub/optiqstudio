"use client";

// VoiceRail — the speaker picker, rebuilt for the bold rail.
//
// This is now the CONTENT of the rail, not the rail itself: the studio shell
// owns the column (and the sheet it turns into on a phone), so this component
// just draws groups of speakers into whatever it's given. That's why there's no
// <aside> here any more.
//
// Each speaker is a full-width row with a real face, the name at 15px bold, the
// accent under it, and its own play button for the pre-generated sample from
// /media/voice-samples/<id>.wav. Selected is inked, not tinted.

import React, { useRef, useState } from "react";
import { Icon } from "../../../../components/icons";
import { RailChoice, RailGroup } from "../../_shell/StudioRail";
import { VOICE_PROFILES, VOICE_REGIONS, VoiceProfile } from "./voiceProfiles";

// /media/* is served with an immutable 1-year cache (see next.config.ts), so a
// regenerated sample keeps its filename but must change its URL to be re-fetched.
// Bump this whenever the sample clips are regenerated.
const SAMPLE_VERSION = 2;

export function useSamplePlayer() {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggle = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
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

function SampleButton({
  playing,
  loading,
  selected,
  onClick,
}: {
  playing: boolean;
  loading: boolean;
  selected: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={playing ? "Stop sample" : "Play sample"}
      title={playing ? "Stop sample" : "Play sample"}
      className={`flex h-11 w-11 items-center justify-center rounded-full border transition-all active:scale-95 ${
        selected
          ? "border-background/30 text-background hover:bg-background/15"
          : "border-line-2 text-ink-2 hover:border-foreground hover:bg-surface-2 hover:text-foreground"
      }`}
    >
      <Icon
        name={loading ? "spinner" : playing ? "pause" : "play"}
        size={15}
        className={loading ? "animate-spin" : ""}
      />
    </button>
  );
}

interface VoiceRailProps {
  selectedId: string;
  onSelect: (id: string) => void;
  /** Shared with the studio so the dock's Preview tile drives the same audio. */
  player: ReturnType<typeof useSamplePlayer>;
}

export default function VoiceRail({ selectedId, onSelect, player }: VoiceRailProps) {
  return (
    <>
      {VOICE_REGIONS.map((region) => {
        const group = VOICE_PROFILES.filter((p: VoiceProfile) => p.region === region);
        if (group.length === 0) return null;
        return (
          <RailGroup key={region} title={region} hint={`${group.length} voices`}>
            <div className="space-y-2">
              {group.map((p) => {
                const selected = selectedId === p.id;
                return (
                  <RailChoice
                    key={p.id}
                    label={p.name}
                    sub={p.accent}
                    selected={selected}
                    onSelect={() => onSelect(p.id)}
                    media={
                      <span className="h-11 w-11 shrink-0 overflow-hidden rounded-2xl border border-line-2 bg-surface-2">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/media/voice-faces/${p.id}.jpg`}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      </span>
                    }
                    trailing={
                      <SampleButton
                        selected={!!selected}
                        playing={player.playingId === p.id}
                        loading={player.loadingId === p.id}
                        onClick={(e) => player.toggle(p.id, e)}
                      />
                    }
                  />
                );
              })}
            </div>
          </RailGroup>
        );
      })}
    </>
  );
}
