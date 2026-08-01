"use client";

import React from "react";
import Link from "next/link";
import { Clapperboard, Video, ChevronRight } from "lucide-react";
import { useEditorFlow } from "../_flow/EditorFlowProvider";

export default function HomePortal() {
  const { goCreate } = useEditorFlow();

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background text-foreground">
      {/* ─── PORTAL GATEWAY: CENTERED MINIMAL CARD PORTAL ────────────────────── */}
      {/* pt-20 clears the floating chrome; centres on desktop, flows on phones */}
      <div className="flex flex-1 items-center justify-center px-4 pt-20 pb-8 sm:p-6 sm:pt-24 md:p-12 md:pt-24">
        <div className="grid w-full max-w-4xl grid-cols-1 gap-4 sm:gap-6 md:gap-8 md:grid-cols-2">
          {/* OPTION 1: AGENTIC STORYBOARDING */}
          <button
            onClick={goCreate}
            className="group relative flex flex-col items-center justify-center rounded-3xl bg-background p-6 sm:p-10 text-center transition-all duration-300 elevate-lg hover:shadow-black/5 active:scale-[0.99] min-h-[260px] sm:min-h-[340px] md:min-h-[380px]"
          >
            {/* Loop video cover showing cinematic ambient scene */}
            {/* The dashed border is NOT on the button: `inset-0` resolves to the
                padding box, so a border on the parent sits 2px outside the cover
                and leaves a white ring between the dash and the footage. Border
                and cover are both drawn here, on the same box, so they meet. */}
            <div className="absolute inset-0 z-0 overflow-hidden rounded-[inherit]">
              <video
                src="/media/dash-storyboard.mp4"
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
                className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              {/* A slight white tint + blur stays on permanently so the copy is
                  always legible; hover just deepens both. */}
              <div className="absolute inset-0 bg-background/50 backdrop-blur-[3px] transition-all duration-500 group-hover:bg-background/65 group-hover:backdrop-blur-md" />
            </div>

            {/* Dashed edge, same box and same radius as the cover above */}
            <div className="pointer-events-none absolute inset-0 z-20 rounded-[inherit] border-2 border-dashed border-accent" />

            {/* Tilted tag at the top */}
            <span className="absolute -top-2.5 left-6 z-20 -rotate-6 rounded-lg bg-accent border border-accent-line px-2.5 py-0.5 text-[10px] font-extrabold tracking-widest text-white uppercase shadow-lg shadow-accent/20 select-none">
              New
            </span>

            <div className="relative z-10 flex flex-col items-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-surface-2 border border-line text-ink-2 group-hover:scale-110 transition-transform">
                <Clapperboard size={26} />
              </span>
              <h2 className="mt-8 text-2xl font-bold text-foreground tracking-tight">Storyboard</h2>
              <span className="mt-2.5 inline-flex text-[11px] font-bold tracking-wider text-foreground bg-surface-2 border border-line rounded-full px-3 py-0.5 uppercase">
                Agentic Director
              </span>
              {/* Sitting on the tint, not on a flat surface — black and bold. */}
              <p className="mt-4 text-xs font-bold text-foreground leading-relaxed max-w-xs">
                Pitch your concept or script. Our Optiq AI director drafts a complete, cohesive multi-scene storyboard with custom style headers instantly.
              </p>
              <span className="mt-8 inline-flex items-center gap-1.5 rounded-2xl bg-accent hover:bg-accent-hover text-xs font-bold text-white px-5 py-2.5 transition-all duration-300 shadow-lg shadow-accent/15 border border-accent-line group-hover:scale-[1.03] active:scale-[0.98]">
                Create your ad <ChevronRight size={13} />
              </span>
            </div>
          </button>

          {/* OPTION 2: DIRECT STUDIO GATEWAY WITH THREE SUB-BOXES */}
          <div className="flex flex-col justify-center rounded-3xl border-2 border-dashed border-accent bg-surface/40 p-6 sm:p-10 transition-all duration-300 min-h-[260px] sm:min-h-[340px] md:min-h-[380px]">
            <div className="flex flex-col items-center text-center">
              <span className="flex h-14 w-16 items-center justify-center rounded-3xl bg-surface border border-line text-ink-3">
                <Video size={24} />
              </span>
              <h2 className="mt-6 text-2xl font-bold text-foreground tracking-tight">Direct Studio</h2>
              <span className="mt-2 inline-flex text-[10px] font-semibold tracking-wider text-muted bg-surface rounded-full px-3 py-0.5 uppercase">
                Instant Rendering
              </span>
              <p className="mt-3 text-xs text-muted leading-relaxed max-w-xs">
                Skip the planning stage and jump straight into generating standalone video segments, audio, or graphics.
              </p>
            </div>

            {/* The Three Inner Sub-Boxes: Video Studio, Image Studio & Audio Studio */}
            <div className="mt-6 grid grid-cols-3 gap-3">
              <Link
                href="/dashboard/video"
                className="group/item relative flex flex-col justify-end overflow-hidden rounded-2xl border border-line bg-surface-2 aspect-video hover:border-line transition-all duration-300 shadow-lg"
              >
                <video
                  src="/media/dash-video-studio.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                  className="absolute inset-0 h-full w-full object-cover group-hover/item:scale-105 transition-transform duration-500"
                />
                {/* Permanent slight white tint + blur, deepening on hover. */}
                <div className="absolute inset-0 bg-background/45 backdrop-blur-[3px] transition-all duration-500 group-hover/item:bg-background/60 group-hover/item:backdrop-blur-md" />
                <div className="relative z-10 flex items-center justify-between p-3">
                  <span className="text-[10px] font-bold text-foreground tracking-wide">Video Studio</span>
                  <ChevronRight size={11} className="text-foreground group-hover/item:translate-x-0.5 transition-transform animate-none" />
                </div>
              </Link>

              <Link
                href="/dashboard/image"
                className="group/item relative flex flex-col justify-end overflow-hidden rounded-2xl border border-line bg-surface-2 aspect-video hover:border-line transition-all duration-300 shadow-lg"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/media/app-video.jpg"
                  alt="Image Studio Reference"
                  className="absolute inset-0 h-full w-full object-cover group-hover/item:scale-105 transition-transform duration-500"
                />
                {/* Permanent slight white tint + blur, deepening on hover. */}
                <div className="absolute inset-0 bg-background/45 backdrop-blur-[3px] transition-all duration-500 group-hover/item:bg-background/60 group-hover/item:backdrop-blur-md" />
                <div className="relative z-10 flex items-center justify-between p-3">
                  <span className="text-[10px] font-bold text-foreground tracking-wide">Image Studio</span>
                  <ChevronRight size={11} className="text-foreground group-hover/item:translate-x-0.5 transition-transform animate-none" />
                </div>
              </Link>

              <Link
                href="/dashboard/audio"
                className="group/item relative flex flex-col justify-end overflow-hidden rounded-2xl border border-line bg-surface-2 aspect-video hover:border-line transition-all duration-300 shadow-lg"
              >
                <video
                  src="/media/dash-audio-studio.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                  className="absolute inset-0 h-full w-full object-cover group-hover/item:scale-105 transition-transform duration-500"
                />
                {/* Permanent slight white tint + blur, deepening on hover. */}
                <div className="absolute inset-0 bg-background/45 backdrop-blur-[3px] transition-all duration-500 group-hover/item:bg-background/60 group-hover/item:backdrop-blur-md" />
                <div className="relative z-10 flex items-center justify-between p-3">
                  <span className="text-[10px] font-bold text-foreground tracking-wide">Audio Studio</span>
                  <ChevronRight size={11} className="text-foreground group-hover/item:translate-x-0.5 transition-transform animate-none" />
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
