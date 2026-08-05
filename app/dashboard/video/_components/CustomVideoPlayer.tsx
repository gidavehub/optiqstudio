"use client";

import React, { useEffect, useRef, useState } from "react";
import { Download, Maximize, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { Aspect } from "./types";

interface CustomVideoPlayerProps {
  src: string;
  aspect: Aspect;
  /** When set, a download action appears alongside the volume/fullscreen controls. */
  downloadUrl?: string;
  downloadName?: string;
}

export default function CustomVideoPlayer({ src, aspect, downloadUrl, downloadName }: CustomVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [, setIsFullscreen] = useState(false);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMute = !videoRef.current.muted;
    videoRef.current.muted = nextMute;
    setIsMuted(nextMute);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const val = parseFloat(e.target.value);
    videoRef.current.currentTime = val;
    setCurrentTime(val);
  };

  const handleFullscreen = () => {
    if (!videoRef.current) return;
    if (!document.fullscreenElement) {
      videoRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleEnded = () => {
    setIsPlaying(false);
  };

  useEffect(() => {
    Promise.resolve().then(() => setIsPlaying(true));
  }, [src]);

  return (
    // A 9:16 at full column width is taller than the viewport, so portrait is
    // capped by height and the width follows from the ratio. Landscape is
    // unaffected — it never gets near the cap.
    <div
      className="group relative mx-auto w-full overflow-hidden rounded-2xl border border-line bg-background elevate-lg"
      style={aspect === "9:16" ? { maxWidth: "min(100%, calc(72vh * 9 / 16))" } : undefined}
    >
      <video
        ref={videoRef}
        src={src}
        autoPlay
        loop={false}
        onEnded={handleEnded}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onClick={togglePlay}
        className="w-full object-cover cursor-pointer"
        style={{ aspectRatio: aspect === "9:16" ? "9/16" : "16/9" }}
      />

      {/* Control overlay — stark monochrome glassmorphism */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-background/85 backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col gap-2 z-20">
        {/* Progress seek bar */}
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1 bg-surface-3 rounded-xl appearance-none cursor-pointer accent-accent hover:h-1.5 transition-all"
            style={{
              background: `linear-gradient(to right, #1a73e8 ${((currentTime / (duration || 1)) * 100).toFixed(2)}%, rgba(0, 0, 0, 0.12) ${((currentTime / (duration || 1)) * 100).toFixed(2)}%)`,
            }}
          />
        </div>

        {/* Action controls */}
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-4">
            <button
              onClick={togglePlay}
              className="text-foreground hover:text-ink-2 transition-colors p-1 rounded-full hover:bg-surface-2"
            >
              {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
            </button>

            <span className="text-[11px] tabular-nums text-ink-2">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {downloadUrl && (
              <a
                href={downloadUrl}
                download={downloadName ?? "optiq_video.mp4"}
                onClick={(e) => e.stopPropagation()}
                title="Download MP4"
                className="text-foreground hover:text-accent-ink transition-colors p-1 rounded-full hover:bg-surface-2"
              >
                <Download size={15} />
              </a>
            )}
            <button
              onClick={toggleMute}
              className="text-foreground hover:text-ink-2 transition-colors p-1 rounded-full hover:bg-surface-2"
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>

            <button
              onClick={handleFullscreen}
              className="text-foreground hover:text-ink-2 transition-colors p-1 rounded-full hover:bg-surface-2"
            >
              <Maximize size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
