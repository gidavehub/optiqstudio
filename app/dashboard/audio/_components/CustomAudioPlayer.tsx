"use client";

import React, { useEffect, useRef, useState } from "react";
import { Download, Pause, Play } from "lucide-react";

interface CustomAudioPlayerProps {
  src: string;
}

export default function CustomAudioPlayer({ src }: CustomAudioPlayerProps) {
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
    <div className="group relative w-full overflow-hidden rounded-2xl border border-neutral-800 bg-surface/95 p-4 shadow-xl flex items-center gap-4 backdrop-blur-md">
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
          <span>
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
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
              background: `linear-gradient(to right, #ffffff ${((currentTime / (duration || 1)) * 100).toFixed(2)}%, rgba(255, 255, 255, 0.2) ${((currentTime / (duration || 1)) * 100).toFixed(2)}%)`,
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
