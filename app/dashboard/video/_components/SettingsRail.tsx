"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, DollarSign, Flame, Settings, Volume2, VolumeX } from "lucide-react";
import Segmented from "./Segmented";
import { ASPECTS, DURATIONS, RESOLUTIONS, Aspect, Duration, Resolution } from "./types";

interface SettingsRailProps {
  aspect: Aspect;
  setAspect: (v: Aspect) => void;
  duration: Duration;
  setDuration: (v: Duration) => void;
  resolution: Resolution;
  setResolution: (v: Resolution) => void;
  audioOn: boolean;
  setAudioOn: (v: boolean) => void;
  negativePrompt: string;
  setNegativePrompt: (v: string) => void;
  credits: number | null;
}

export default function SettingsRail({
  aspect,
  setAspect,
  duration,
  setDuration,
  resolution,
  setResolution,
  audioOn,
  setAudioOn,
  negativePrompt,
  setNegativePrompt,
  credits,
}: SettingsRailProps) {
  return (
    <aside className="w-68 shrink-0 space-y-6 overflow-y-auto border-r border-neutral-900 p-5 bg-background flex flex-col justify-between">
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
          <p className="eyebrow mb-2">Engine Model</p>
          <div className="rounded-lg border border-neutral-800 bg-surface px-3 py-2.5">
            <p className="text-sm font-medium text-white flex items-center gap-2">
              <Flame size={14} className="text-neutral-300" />
              Gemini Omni Flash
            </p>
            <p className="text-[11px] text-neutral-400 mt-0.5">Highest fidelity, native audio sync</p>
          </div>
        </div>

        <Segmented label="Aspect ratio" options={ASPECTS} value={aspect} onChange={setAspect} />
        <Segmented label="Duration" options={DURATIONS} value={duration} onChange={setDuration} render={(d) => `${d}s`} />
        <Segmented label="Resolution" options={RESOLUTIONS} value={resolution} onChange={setResolution} />

        <div>
          <p className="eyebrow mb-2">Native Audio Track</p>
          <button
            onClick={() => setAudioOn(!audioOn)}
            className="flex w-full items-center justify-between rounded-lg border border-neutral-800 bg-surface px-3 py-2.5 text-sm hover:border-neutral-700 transition-colors"
          >
            <span>{audioOn ? "Synthesize on-the-fly" : "Silent render"}</span>
            {audioOn ? <Volume2 size={14} /> : <VolumeX size={14} className="text-neutral-500" />}
          </button>
        </div>

        <div>
          <p className="eyebrow mb-2">Negative restrictions</p>
          <textarea
            rows={1}
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            placeholder="Blurry, low-fps, artifacts…"
            className="w-full resize-none rounded-lg border border-neutral-800 bg-surface px-3 py-2 text-xs placeholder:text-neutral-600 focus:border-neutral-700 font-mono"
          />
        </div>
      </div>

      {/* ── CREDIT ESTIMATION & GENERATION UTILITY ── */}
      <div className="border-t border-neutral-900 pt-5 mt-auto">
        <div className="flex items-center gap-2 mb-2">
          <DollarSign size={14} className="text-neutral-300" />
          <span className="text-[10px] font-bold font-mono text-neutral-400 uppercase tracking-wider">
            Wallet Balance Guide
          </span>
        </div>
        <div className="bg-[#040405] rounded-xl p-3.5 border border-neutral-900 text-[11px] space-y-2.5">
          <p className="text-[10px] text-neutral-500 leading-normal font-sans">
            Your wallet balance is consumed on a per-action flat rate basis. No complex credit conversions:
          </p>
          <div className="space-y-1.5 font-mono text-[10px] text-neutral-400 border-t border-neutral-900 pt-2.5">
            <div className="flex justify-between">
              <span>Direct Video Clip:</span>
              <span className="text-white font-semibold font-mono">GMD 100.00</span>
            </div>
            <div className="flex justify-between">
              <span>Direct Audio Synth:</span>
              <span className="text-white font-semibold font-mono">GMD 100.00</span>
            </div>
            <div className="flex justify-between">
              <span>Direct Image Gen:</span>
              <span className="text-white font-semibold font-mono">GMD 100.00</span>
            </div>
            <div className="flex justify-between">
              <span>Storyboard (30s):</span>
              <span className="text-white font-semibold font-mono">GMD 300.00</span>
            </div>
            <div className="flex justify-between">
              <span>Storyboard (60s):</span>
              <span className="text-white font-semibold font-mono">GMD 600.00</span>
            </div>
            <div className="flex justify-between">
              <span>Storyboard (90s):</span>
              <span className="text-white font-semibold font-mono">GMD 900.00</span>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-neutral-900 bg-surface/50 px-3 py-2 mt-3 text-[10px] text-neutral-400 font-mono flex justify-between">
          <span>
            Clip Cost: <strong className="text-white font-semibold">GMD 100.00</strong>
          </span>
          <span>
            Balance: <strong className="text-neutral-200">{credits !== null ? `GMD ${credits.toLocaleString()}` : "—"}</strong>
          </span>
        </div>
      </div>
    </aside>
  );
}
