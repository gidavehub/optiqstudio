"use client";

// AudioProjectsGrid — the "All takes" / "All tracks" wall for the Optiq Voice
// Engine and Optiq Music studios. Each item is a proper music-player card: a
// play/pause control, a human-looking waveform that fills as it plays, and a
// download button — not a video tile.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Download, Loader2, MoreVertical, Music, Pause, Play, RotateCcw, Trash2 } from "lucide-react";

export interface AudioGridItem {
  id: string;
  status: string;
  prompt: string;
  audioUrl: string | null;
  createdAt: string;
}

interface AudioProjectsGridProps {
  items: AudioGridItem[];
  variant: "voice" | "music";
  openedMenuId: string | null;
  setOpenedMenuId: (id: string | null) => void;
  deletingIds: Set<string>;
  /** Ids created this session — they play the landing animation once. */
  freshIds?: Set<string>;
  onDelete: (id: string, e: React.MouseEvent) => void;
  /** Loads this take's script/brief back into the console. */
  onReuse?: (id: string, e: React.MouseEvent) => void;
  emptyTitle?: string;
  emptyHint?: string;
}

// A deterministic, natural-looking waveform (stable per track) from the id.
function waveform(id: string, bars = 64): number[] {
  let seed = 0;
  for (let i = 0; i < id.length; i++) seed = (seed * 31 + id.charCodeAt(i)) >>> 0;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };
  return Array.from({ length: bars }, (_, i) => {
    // A smooth envelope + jitter so it reads like real audio, not noise.
    const env = Math.sin((i / bars) * Math.PI); // fades in/out at the ends
    const h = 0.25 + env * (0.35 + 0.55 * rand());
    return Math.max(0.1, Math.min(1, h));
  });
}

function TrackCard({
  item,
  variant,
  isPlaying,
  progress,
  isFresh,
  onToggle,
  openedMenuId,
  setOpenedMenuId,
  onDelete,
  onReuse,
}: {
  item: AudioGridItem;
  variant: "voice" | "music";
  isPlaying: boolean;
  progress: number;
  isFresh?: boolean;
  onToggle: (e: React.MouseEvent) => void;
  openedMenuId: string | null;
  setOpenedMenuId: (id: string | null) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  onReuse?: (id: string, e: React.MouseEvent) => void;
}) {
  const bars = useMemo(() => waveform(item.id), [item.id]);
  const [downloading, setDownloading] = useState(false);
  const played = variant === "music" ? "bg-emerald-400" : "bg-blue-400";
  const idle = "bg-white/15";
  const Icon = variant === "music" ? Music : Play;

  const isRendering =
    item.status === "rendering" ||
    item.status === "generating" ||
    item.status === "processing" ||
    item.status === "queued" ||
    !item.audioUrl;

  const download = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.audioUrl || downloading) return;
    setDownloading(true);
    try {
      // fetch → blob so the download works cross-origin (Storage URLs ignore the
      // plain download attribute otherwise).
      const res = await fetch(item.audioUrl);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(item.prompt || variant).slice(0, 40).replace(/[^\w -]/g, "").trim() || "optiq-audio"}.wav`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      // Fallback: open in a new tab so the user can save it manually.
      window.open(item.audioUrl, "_blank");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div
      className={`flex flex-col gap-3 rounded-3xl border border-line bg-background p-4 transition-colors hover:border-line ${
        isFresh ? "animate-card-pop" : ""
      }`}
    >
      {/* Prompt + actions */}
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-[12px] leading-snug text-ink-2">{item.prompt}</p>
        <div className="flex shrink-0 items-center gap-0.5">
          {onReuse && !item.id.startsWith("temp_") && (
            <button
              onClick={(e) => onReuse(item.id, e)}
              title="Reuse this prompt"
              className="rounded-full p-1 text-muted transition-colors hover:bg-surface hover:text-foreground"
            >
              <RotateCcw size={13} />
            </button>
          )}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setOpenedMenuId(openedMenuId === item.id ? null : item.id);
              }}
              className="rounded-full p-1 text-muted transition-colors hover:bg-surface hover:text-foreground"
            >
              <MoreVertical size={14} />
            </button>
            {openedMenuId === item.id && (
              <div className="absolute right-0 z-50 mt-1 w-32 rounded-xl border border-line bg-surface py-1 shadow-xl">
                {onReuse && !item.id.startsWith("temp_") && (
                  <button
                    onClick={(e) => onReuse(item.id, e)}
                    className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-xs text-ink-2 transition-colors hover:bg-surface hover:text-foreground"
                  >
                    <RotateCcw size={12} /> Reuse prompt
                  </button>
                )}
                <button
                  onClick={(e) => onDelete(item.id, e)}
                  className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-xs text-danger transition-colors hover:bg-surface hover:text-danger"
                >
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Player row: play · waveform · download */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggle}
          disabled={isRendering}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-background transition-transform hover:scale-105 disabled:opacity-40 ${
            variant === "music" ? "bg-emerald-400" : "bg-accent"
          }`}
        >
          {isRendering ? (
            <Loader2 size={16} className="animate-spin text-ink-3" />
          ) : isPlaying ? (
            <Pause size={16} fill="black" />
          ) : (
            <Icon size={16} fill="black" className={variant === "music" ? "" : "translate-x-[1px]"} />
          )}
        </button>

        <div className="flex h-10 flex-1 items-center gap-[2px] overflow-hidden">
          {bars.map((h, i) => {
            const on = isRendering ? false : i / bars.length <= progress;
            return (
              <span
                key={i}
                className={`w-full rounded-full ${on ? played : idle}`}
                style={{ height: `${Math.round(h * 100)}%` }}
              />
            );
          })}
        </div>

        <button
          onClick={download}
          disabled={isRendering || downloading}
          title="Download"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink-2 transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-40"
        >
          {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
        </button>
      </div>
    </div>
  );
}

export default function AudioProjectsGrid({
  items,
  variant,
  openedMenuId,
  setOpenedMenuId,
  deletingIds,
  freshIds,
  onDelete,
  onReuse,
  emptyTitle = "Nothing generated yet",
  emptyHint = "Type below and your takes will appear here.",
}: AudioProjectsGridProps) {
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingId(null);
    setProgress(0);
  };

  useEffect(() => {
    if (playingId && !items.some((i) => i.id === playingId)) stop();
  }, [items, playingId]);
  useEffect(() => () => stop(), []);

  const toggle = (item: AudioGridItem) => {
    if (!item.audioUrl) return;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (playingId === item.id) {
      setPlayingId(null);
      setProgress(0);
      return;
    }
    const audio = new Audio(item.audioUrl);
    audioRef.current = audio;
    setProgress(0);
    audio.ontimeupdate = () => {
      if (audio.duration) setProgress(audio.currentTime / audio.duration);
    };
    audio.onended = () => {
      setPlayingId(null);
      setProgress(0);
    };
    audio.onerror = () => stop();
    void audio.play().then(() => setPlayingId(item.id)).catch(() => stop());
  };

  const visible = items.filter((i) => !deletingIds.has(i.id));

  if (visible.length === 0) {
    return (
      <div className="flex flex-col items-center py-24 text-center text-faint sm:py-28">
        <Music size={34} className="mb-4 text-faint" />
        <h3 className="text-sm font-semibold text-ink-3">{emptyTitle}</h3>
        <p className="mt-1 max-w-xs text-xs leading-normal text-faint">{emptyHint}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {visible.map((item) => (
        <TrackCard
          key={item.id}
          item={item}
          variant={variant}
          isPlaying={playingId === item.id}
          progress={playingId === item.id ? progress : 0}
          isFresh={freshIds?.has(item.id)}
          onToggle={(e) => {
            e.stopPropagation();
            toggle(item);
          }}
          openedMenuId={openedMenuId}
          setOpenedMenuId={setOpenedMenuId}
          onDelete={onDelete}
          onReuse={onReuse}
        />
      ))}
    </div>
  );
}
