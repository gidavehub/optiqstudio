"use client";

import React, { useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

export default function AudioPlayerPreview({ audio }: { audio: { preview: string; name: string } }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-lg bg-neutral-900 border border-neutral-800 px-2.5 py-1.5 shrink-0 select-none">
      <audio ref={audioRef} src={audio.preview} onEnded={() => setIsPlaying(false)} className="hidden" />
      <button
        type="button"
        onClick={togglePlay}
        className="p-1 rounded-full bg-neutral-800 hover:bg-neutral-700 transition-colors text-neutral-300 hover:text-white flex items-center justify-center shrink-0"
      >
        {isPlaying ? <Pause size={10} /> : <Play size={10} />}
      </button>
      <span className="text-[10px] text-neutral-300 font-mono max-w-[120px] truncate" title={audio.name}>
        {audio.name}
      </span>
    </div>
  );
}
