"use client";

// A looping, muted, autoplaying video thumbnail — every grid tile plays on its
// own the way the studios did before. `muted` + `playsInline` are required for
// browsers to allow autoplay; `loop` means a tile never freezes on a static
// frame. The `fallback` shows until the first frame has decoded.
//
// Only tiles actually on screen decode. Every tile used to be `preload="auto"`
// and playing from mount, so a studio holding thirty renders had thirty videos
// fetching and decoding simultaneously — that is what made the wall stutter.
// The source is now attached lazily and playback is driven by an
// IntersectionObserver, so off-screen tiles cost nothing.

import React, { useEffect, useRef, useState } from "react";

interface HoverPreviewVideoProps {
  src: string;
  className?: string;
  /** Rendered underneath while the first frame is still decoding. */
  fallback?: React.ReactNode;
}

export default function HoverPreviewVideo({ src, className = "", fallback }: HoverPreviewVideoProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Attaching the src is what starts the download, so it stays off
          // until the tile is nearly on screen.
          setActive(true);
          void el.play().catch(() => undefined); // autoplay may be refused; harmless
        } else {
          el.pause();
        }
      },
      // Margin so a tile is already running by the time it scrolls into view.
      { rootMargin: "200px 0px", threshold: 0.01 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      {!ready && fallback}
      <video
        ref={ref}
        src={active ? src : undefined}
        autoPlay
        muted
        loop
        playsInline
        preload="none"
        onLoadedData={() => setReady(true)}
        className={className}
      />
    </>
  );
}
