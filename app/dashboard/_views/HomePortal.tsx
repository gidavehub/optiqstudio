"use client";

import React from "react";
import Link from "next/link";
import { Clapperboard, Palette, ChevronRight } from "lucide-react";
import { useEditorFlow } from "../_flow/EditorFlowProvider";

/* The four Direct Studio tiles. Each one sells the *outcome* — a brand kit, a
   voiceover, a track — not the model behind it, so the artwork is a finished
   piece of work and the label sits underneath in plain black on the white
   canvas rather than floating over the image. */
const STUDIOS = [
  {
    href: "/dashboard/video",
    label: "Video Studio",
    caption: "Ads & product films",
    media: { type: "video" as const, src: "/media/portal-video.mp4" },
  },
  {
    href: "/dashboard/image",
    label: "Image Studio",
    caption: "Logos & brand kits",
    media: { type: "image" as const, src: "/media/portal-image.jpg" },
  },
  {
    href: "/dashboard/voice",
    label: "Voice Studio",
    caption: "Voiceovers & narration",
    media: { type: "image" as const, src: "/media/portal-voice.jpg" },
  },
  {
    href: "/dashboard/music",
    label: "Music Studio",
    caption: "Original tracks & beds",
    media: { type: "image" as const, src: "/media/portal-music.jpg" },
  },
];

export default function HomePortal() {
  const { goCreate } = useEditorFlow();

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-background text-foreground">
      {/* ─── PORTAL GATEWAY: TWO RAISED CARDS ─────────────────────────────────── */}
      {/* pt-20 clears the floating chrome; centres on desktop, flows on phones */}
      <div className="flex flex-1 items-center justify-center px-4 pt-20 pb-8 sm:p-6 sm:pt-24 md:p-12 md:pt-24">
        <div className="grid w-full max-w-5xl grid-cols-1 items-stretch gap-5 sm:gap-6 md:gap-8 md:grid-cols-2">
          {/* ── OPTION 1: STORYBOARD — THE WHOLE AD, BUILT FOR YOU ───────────── */}
          {/* No border at all: the card is defined by its own footage plus a deep
              ambient shadow, which is what makes it read as raised rather than
              as a hole punched in the canvas. And no overflow-hidden — the cover
              clips itself, so the New tag stays free to hang over the top edge. */}
          <button
            onClick={goCreate}
            className="group relative flex flex-col items-center justify-center rounded-3xl bg-background p-6 sm:p-10 text-center transition-all duration-300 elevate-xl hover:-translate-y-1 active:translate-y-0 active:scale-[0.99] min-h-[300px] sm:min-h-[380px] md:min-h-[420px]"
          >
            {/* Loop video cover showing the kind of ad this actually produces */}
            <div className="absolute inset-0 z-0 overflow-hidden rounded-[inherit]">
              <video
                src="/media/portal-storyboard.mp4"
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
                className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              {/* Pure blur, no tint. The footage keeps its colour; legibility
                  comes from white type plus the text-shadow set below. */}
              <div className="absolute inset-0 backdrop-blur-[3px] transition-all duration-500 group-hover:backdrop-blur-md" />
            </div>

            {/* Tilted tag at the top */}
            <span className="absolute -top-2.5 left-6 z-20 -rotate-6 rounded-lg bg-accent border border-accent-line px-2.5 py-0.5 text-[10px] font-extrabold tracking-widest text-white uppercase shadow-lg shadow-accent/20 select-none">
              New
            </span>

            {/* text-shadow is inherited, so one declaration covers the block —
                it's what buys white copy over un-tinted footage. */}
            <div className="relative z-10 flex flex-col items-center [text-shadow:0_2px_18px_rgba(0,0,0,0.55)]">
              <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white/15 border border-white/30 text-white backdrop-blur-md group-hover:scale-110 transition-transform">
                <Clapperboard size={26} />
              </span>
              <h2 className="mt-8 text-2xl font-bold text-white tracking-tight">Storyboard</h2>
              <span className="mt-2.5 inline-flex text-[11px] font-bold tracking-wider text-white bg-white/15 border border-white/30 backdrop-blur-md rounded-full px-3 py-0.5 uppercase">
                The Whole Ad
              </span>
              <p className="mt-4 text-[13px] font-semibold text-white leading-relaxed max-w-xs">
                Tell us the brand. Our agents write the script, cast the faces, shoot every scene and lay the
                voiceover — and hand you a finished ad, not a prompt.
              </p>
              <span className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-accent hover:bg-accent-hover text-sm font-bold text-white px-7 py-3.5 transition-all duration-300 shadow-lg shadow-accent/25 border border-accent-line group-hover:scale-[1.03] active:scale-[0.98] [text-shadow:none]">
                Create your ad <ChevronRight size={15} />
              </span>
            </div>
          </button>

          {/* ── OPTION 2: DIRECT STUDIO — FOUR STUDIOS, ONE CARD ─────────────── */}
          <div className="flex flex-col rounded-3xl border border-line bg-background p-6 sm:p-8 elevate-xl transition-all duration-300">
            <div className="flex flex-col items-center text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-3xl bg-surface-2 border border-line text-ink-2">
                <Palette size={24} />
              </span>
              <h2 className="mt-5 text-2xl font-bold text-foreground tracking-tight">Direct Studio</h2>
              <span className="mt-2 inline-flex text-[10px] font-bold tracking-wider text-ink-3 bg-surface-2 border border-line rounded-full px-3 py-0.5 uppercase">
                Your Brand Team
              </span>
              <p className="mt-3 text-xs text-muted leading-relaxed max-w-sm">
                Logos, campaign visuals, voiceovers and original music — briefed like an agency, delivered in
                minutes.
              </p>
            </div>

            {/* The four studios. 2×2 on every width, so the card keeps its shape
                when it stacks under the storyboard card on phones. */}
            <div className="mt-6 grid grid-cols-2 gap-4 sm:gap-5">
              {STUDIOS.map((studio) => (
                <Link key={studio.href} href={studio.href} className="group/item block">
                  {/* Artwork only — no tint, nothing over it. */}
                  {/* Shadows here are Tailwind utilities rather than the
                      .elevate class: .elevate is unlayered CSS and would
                      outrank the layered `group-hover:shadow-*` utility, so the
                      hover state would never paint. */}
                  <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-surface-2 shadow-[0_1px_3px_rgba(16,24,40,0.05),0_8px_20px_-6px_rgba(16,24,40,0.14)] transition-all duration-300 group-hover/item:-translate-y-1 group-hover/item:shadow-[0_2px_6px_rgba(16,24,40,0.08),0_18px_36px_-10px_rgba(16,24,40,0.24)]">
                    {studio.media.type === "video" ? (
                      <video
                        src={studio.media.src}
                        autoPlay
                        loop
                        muted
                        playsInline
                        preload="metadata"
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover/item:scale-105"
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={studio.media.src}
                        alt={studio.label}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover/item:scale-105"
                      />
                    )}
                  </div>
                  <div className="mt-2.5 flex items-center gap-1">
                    <span className="text-[13px] font-bold text-foreground tracking-tight">{studio.label}</span>
                    <ChevronRight
                      size={13}
                      className="text-ink-3 transition-transform group-hover/item:translate-x-0.5"
                    />
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted leading-snug">{studio.caption}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
