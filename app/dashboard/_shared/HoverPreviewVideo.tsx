"use client";

// A video thumbnail that does NOT stream until you actually look at it.
//
// Grids used to render every tile as <video autoPlay loop muted>, so opening a
// page with nine projects kicked off nine simultaneous downloads of full mp4s
// and decoded nine video streams at once. That saturated the connection and
// made everything — including the video you actually wanted — slow to appear.
//
// Instead: load metadata only (enough for the browser to paint the first
// frame), then play on hover / touch, and pause + rewind on leave. One stream
// at a time, and the poster frame is effectively free.

import React, { useCallback, useRef, useState } from "react";

interface HoverPreviewVideoProps {
  src: string;
  className?: string;
  /** Rendered underneath while the first frame is still decoding. */
  fallback?: React.ReactNode;
}

export default function HoverPreviewVideo({ src, className = "", fallback }: HoverPreviewVideoProps) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [ready, setReady] = useState(false);

  const play = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    // play() rejects if the element is detached mid-interaction — harmless.
    void el.play().catch(() => {});
  }, []);

  const pause = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.pause();
    el.currentTime = 0;
  }, []);

  return (
    <>
      {!ready && fallback}
      <video
        ref={ref}
        src={src}
        muted
        loop
        playsInline
        preload="metadata"
        onLoadedData={() => setReady(true)}
        onMouseEnter={play}
        onMouseLeave={pause}
        onTouchStart={play}
        className={className}
      />
    </>
  );
}
