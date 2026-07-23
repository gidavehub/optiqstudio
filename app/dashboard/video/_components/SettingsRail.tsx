"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AspectRatioPicker from "../../_shared/AspectRatioPicker";
import { VIDEO_ASPECTS } from "../../_shared/aspectOptions";
import { DURATIONS, Aspect, Duration } from "./types";

interface SettingsRailProps {
  aspect: Aspect;
  setAspect: (v: Aspect) => void;
  duration: Duration;
  setDuration: (v: Duration) => void;
  /** Wallet cost per generated second (from live pricing). */
  perSecondCost: number;
}

export default function SettingsRail({
  aspect,
  setAspect,
  duration,
  setDuration,
  perSecondCost,
}: SettingsRailProps) {
  return (
    // Full width and stacked above the canvas on phones; a fixed rail from sm up.
    <aside className="hidden w-full shrink-0 space-y-7 overflow-y-auto border-b border-neutral-900 bg-background p-5 sm:block sm:w-64 sm:border-b-0 sm:border-r sm:pt-24">
      <Link
        href="/dashboard"
        className="group flex w-fit items-center gap-1.5 font-mono text-[11px] font-bold uppercase tracking-wider text-neutral-500 transition-colors hover:text-white"
      >
        <ArrowLeft size={12} className="transition-transform group-hover:-translate-x-0.5" />
        Back
      </Link>

      <AspectRatioPicker
        options={VIDEO_ASPECTS}
        value={aspect}
        onChange={(v) => setAspect(v as Aspect)}
      />

      {/* ── CLIP LENGTH & PRICING ── */}
      <div>
        <p className="eyebrow mb-2.5">Clip length</p>
        <div className="relative space-y-1 overflow-hidden rounded-2xl border border-neutral-800/80 bg-[#07090f] p-1.5">
          {DURATIONS.map((d) => {
            const active = d === duration;
            return (
              <button
                key={d}
                onClick={() => setDuration(d)}
                className={`group flex w-full items-center justify-between rounded-xl border px-3.5 py-2.5 transition-all ${
                  active
                    ? "border-blue-500/60 bg-[#0c152d] shadow-[0_0_24px_-8px_rgba(59,130,246,0.55)]"
                    : "border-transparent hover:border-neutral-800 hover:bg-white/[0.03]"
                }`}
              >
                <span
                  className={`text-sm font-semibold tracking-tight ${
                    active ? "text-white" : "text-neutral-400 group-hover:text-neutral-200"
                  }`}
                >
                  {d}s
                </span>
                <span
                  className={`font-mono text-[12px] font-bold ${
                    active ? "text-blue-300" : "text-neutral-500 group-hover:text-neutral-300"
                  }`}
                >
                  GMD {(perSecondCost * d).toFixed(0)}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-center font-mono text-[10px] text-neutral-600">Pay only for what you generate</p>
      </div>
    </aside>
  );
}
