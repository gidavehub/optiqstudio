"use client";

import { useState } from "react";
import { Play } from "lucide-react";

/**
 * A click-to-load YouTube facade.
 *
 * A real iframe costs ~1.5MB and several hundred ms of main-thread work per
 * embed, and these articles carry three or four each. Until someone presses
 * play this is one lazy thumbnail.
 *
 * Thumbnails fall back in stages, because a video that is scheduled or still
 * unlisted serves no image at all:
 *
 *   maxresdefault → hqdefault → the reserved-slot card
 *
 * That means a draft looks deliberate today, and the same component turns into
 * a real player the moment the video goes public — no redeploy needed.
 */
export default function LiteYouTube({
  id,
  title,
  premiere,
}: {
  id: string | null;
  title: string;
  /** Shown on the reserved card, e.g. "Premieres 30 July, 4:00 PM GMT". */
  premiere?: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [thumb, setThumb] = useState<"max" | "hq" | "none">("max");

  const reserved = (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#dadce0] bg-white">
        <Play size={20} className="ml-0.5 text-[#5f6368]" fill="currentColor" strokeWidth={0} />
      </div>
      <p className="mt-4 max-w-md text-[15px] font-medium text-[#1f1f1f]">{title}</p>
      <p className="mt-1.5 text-[13px] text-[#5f6368]">
        {premiere ?? "Publishing shortly — this player goes live with the broadcast."}
      </p>
    </div>
  );

  if (!id) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-[#e8eaed] bg-[#f8f9fa]">
        {reserved}
      </div>
    );
  }

  if (playing) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="absolute inset-0 h-full w-full"
        />
      </div>
    );
  }

  // No thumbnail resolved: keep the slot readable, but still let it play — the
  // video may be watchable even when the poster frame isn't served yet.
  if (thumb === "none") {
    return (
      <button
        type="button"
        onClick={() => setPlaying(true)}
        aria-label={`Play video: ${title}`}
        className="relative block aspect-video w-full overflow-hidden rounded-2xl border border-[#e8eaed] bg-[#f8f9fa] text-left"
      >
        {reserved}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label={`Play video: ${title}`}
      className="group relative block aspect-video w-full overflow-hidden rounded-2xl bg-black"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://i.ytimg.com/vi/${id}/${thumb === "max" ? "maxresdefault" : "hqdefault"}.jpg`}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setThumb((t) => (t === "max" ? "hq" : "none"))}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/95 transition-transform duration-200 group-hover:scale-105">
          <Play size={24} className="ml-1 text-[#1f1f1f]" fill="currentColor" strokeWidth={0} />
        </span>
      </span>
    </button>
  );
}
