"use client";

import React from "react";
import Link from "next/link";
import { Clapperboard, Video, ChevronRight } from "lucide-react";
import { useEditorFlow } from "../_flow/EditorFlowProvider";

export default function HomePortal() {
  const { goCreate } = useEditorFlow();

  return (
    <div className="flex h-full flex-col bg-background text-neutral-200">
      {/* ─── PORTAL GATEWAY: CENTERED MINIMAL CARD PORTAL ────────────────────── */}
      <div className="flex flex-1 items-center justify-center p-6 md:p-12 min-h-[calc(100vh-4rem)]">
        <div className="grid w-full max-w-4xl grid-cols-1 gap-8 md:grid-cols-2">
          {/* OPTION 1: AGENTIC STORYBOARDING */}
          <button
            onClick={goCreate}
            className="group relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/5 bg-black p-10 text-center hover:border-white/10 transition-all duration-300 shadow-2xl hover:shadow-neutral-900/10 min-h-[340px] md:min-h-[380px]"
          >
            {/* Loop video cover showing cinematic ambient scene */}
            <div className="absolute inset-0 z-0">
              <video
                src="/media/dash-storyboard.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="h-full w-full object-cover opacity-35 group-hover:opacity-55 group-hover:scale-105 transition-all duration-700"
              />
              <div className="absolute inset-0 bg-[#0a0f1d]/55" />
            </div>

            <div className="relative z-10 flex flex-col items-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#131d35] border border-white/10 text-neutral-300 group-hover:scale-110 transition-transform">
                <Clapperboard size={26} />
              </span>
              <h2 className="mt-8 text-2xl font-bold text-white tracking-tight">Storyboard</h2>
              <span className="mt-2.5 inline-flex text-[11px] font-semibold tracking-wider text-neutral-300 bg-[#131d35] border border-white/10 rounded-full px-3 py-0.5 uppercase">
                Agentic Director
              </span>
              <p className="mt-4 text-xs text-neutral-400 leading-relaxed max-w-xs">
                Pitch your concept or script. Our Gemini AI director drafts a complete, cohesive multi-scene storyboard with custom style headers instantly.
              </p>
              <span className="mt-8 flex items-center gap-1 text-xs font-bold text-white group-hover:translate-x-1 transition-transform">
                Initialize Storyboard <ChevronRight size={14} />
              </span>
            </div>
          </button>

          {/* OPTION 2: DIRECT STUDIO GATEWAY WITH THREE SUB-BOXES */}
          <div className="flex flex-col justify-center rounded-2xl border border-white/5 bg-surface/40 p-10 hover:border-white/10 transition-all duration-300 min-h-[340px] md:min-h-[380px]">
            <div className="flex flex-col items-center text-center">
              <span className="flex h-14 w-16 items-center justify-center rounded-2xl bg-[#0e1630] border border-white/10 text-neutral-400">
                <Video size={24} />
              </span>
              <h2 className="mt-6 text-2xl font-bold text-white tracking-tight">Direct Studio</h2>
              <span className="mt-2 inline-flex text-[10px] font-semibold tracking-wider text-neutral-500 bg-white/5 rounded-full px-3 py-0.5 uppercase">
                Instant Rendering
              </span>
              <p className="mt-3 text-xs text-neutral-500 leading-relaxed max-w-xs">
                Skip the planning stage and jump straight into generating standalone video segments, audio, or graphics.
              </p>
            </div>

            {/* The Three Inner Sub-Boxes: Video Studio, Image Studio & Audio Studio */}
            <div className="mt-6 grid grid-cols-3 gap-3">
              <Link
                href="/dashboard/video"
                className="group/item relative flex flex-col justify-end overflow-hidden rounded-xl border border-white/5 bg-surface-2 aspect-video hover:border-white/10 transition-all duration-300 shadow-lg"
              >
                <video
                  src="/media/dash-video-studio.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="absolute inset-0 h-full w-full object-cover opacity-50 group-hover/item:opacity-85 group-hover/item:scale-105 transition-all duration-500"
                />
                <div className="absolute inset-0 bg-[#0a0f1d]/45" />
                <div className="relative z-10 p-3 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-white tracking-wide">Video Studio</span>
                  <ChevronRight size={11} className="text-neutral-400 group-hover/item:translate-x-0.5 transition-transform animate-none" />
                </div>
              </Link>

              <Link
                href="/dashboard/image"
                className="group/item relative flex flex-col justify-end overflow-hidden rounded-xl border border-white/5 bg-surface-2 aspect-video hover:border-white/10 transition-all duration-300 shadow-lg"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/media/app-video.jpg"
                  alt="Image Studio Reference"
                  className="absolute inset-0 h-full w-full object-cover opacity-50 group-hover/item:opacity-85 group-hover/item:scale-105 transition-all duration-500"
                />
                <div className="absolute inset-0 bg-[#0a0f1d]/45" />
                <div className="relative z-10 p-3 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-white tracking-wide">Image Studio</span>
                  <ChevronRight size={11} className="text-neutral-400 group-hover/item:translate-x-0.5 transition-transform animate-none" />
                </div>
              </Link>

              <Link
                href="/dashboard/audio"
                className="group/item relative flex flex-col justify-end overflow-hidden rounded-xl border border-white/5 bg-surface-2 aspect-video hover:border-white/10 transition-all duration-300 shadow-lg"
              >
                <video
                  src="/media/dash-audio-studio.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="absolute inset-0 h-full w-full object-cover opacity-50 group-hover/item:opacity-85 group-hover/item:scale-105 transition-all duration-500"
                />
                <div className="absolute inset-0 bg-[#0a0f1d]/45" />
                <div className="relative z-10 p-3 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-white tracking-wide">Audio Studio</span>
                  <ChevronRight size={11} className="text-neutral-400 group-hover/item:translate-x-0.5 transition-transform animate-none" />
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
