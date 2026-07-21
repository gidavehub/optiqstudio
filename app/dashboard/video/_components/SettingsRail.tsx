"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Settings, Wallet } from "lucide-react";
import Segmented from "./Segmented";
import { ASPECTS, DURATIONS, Aspect, Duration } from "./types";

interface SettingsRailProps {
  aspect: Aspect;
  setAspect: (v: Aspect) => void;
  duration: Duration;
  setDuration: (v: Duration) => void;
  /** Wallet cost per generated second (from live pricing). */
  perSecondCost: number;
  credits: number | null;
}

export default function SettingsRail({
  aspect,
  setAspect,
  duration,
  setDuration,
  perSecondCost,
  credits,
}: SettingsRailProps) {
  return (
    // Full width and stacked above the canvas on phones; a fixed rail from sm up.
    <aside className="w-full sm:w-68 shrink-0 space-y-6 overflow-y-auto border-b sm:border-b-0 sm:border-r border-neutral-900 p-5 pt-20 sm:pt-5 bg-background flex flex-col justify-between">
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

        <Segmented label="Aspect ratio" options={ASPECTS} value={aspect} onChange={setAspect} />

        {/* ── CLIP LENGTH & PRICING ── */}
        <div>
          <p className="eyebrow mb-2">Clip length &amp; pricing</p>
          <div className="relative rounded-2xl border border-neutral-800/80 bg-[#07090f] p-1.5 overflow-hidden">
            <div className="relative space-y-1">
              {DURATIONS.map((d) => {
                const active = d === duration;
                return (
                  <button
                    key={d}
                    onClick={() => setDuration(d)}
                    className={`group flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 transition-all border ${
                      active
                        ? "border-blue-500/60 bg-[#0c152d] shadow-[0_0_24px_-8px_rgba(59,130,246,0.55)]"
                        : "border-transparent hover:border-neutral-800 hover:bg-white/[0.03]"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={`text-sm font-semibold tracking-tight ${
                          active ? "text-white" : "text-neutral-400 group-hover:text-neutral-200"
                        }`}
                      >
                        {d}s clip
                      </span>
                    </span>
                    <span
                      className={`font-mono text-[12px] font-bold ${
                        active ? "text-blue-300" : "text-neutral-500 group-hover:text-neutral-300"
                      }`}
                    >
                      GMD {(perSecondCost * d).toFixed(2)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <p className="mt-2 text-[10px] text-neutral-600 font-mono text-center">
            Pay only for what you generate
          </p>
        </div>
      </div>

      {/* ── WALLET ── */}
      <div className="border-t border-neutral-900 pt-4 mt-auto">
        <div className="flex items-center justify-between rounded-xl border border-neutral-800/80 bg-[#0a0f1e] px-3.5 py-3">
          <span className="flex items-center gap-2 text-[10px] font-bold font-mono text-neutral-400 uppercase tracking-wider">
            <Wallet size={13} className="text-blue-400" />
            Wallet
          </span>
          <span className="font-mono text-sm font-bold text-white">
            {credits !== null ? `GMD ${credits.toLocaleString()}` : "—"}
          </span>
        </div>
      </div>
    </aside>
  );
}
