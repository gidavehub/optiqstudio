"use client";

// A looping, muted, autoplaying video thumbnail — every grid tile plays on its
// own the way the studios did before. `muted` + `playsInline` are required for
// browsers to allow autoplay; `loop` means a tile never freezes on a static
// frame. The `fallback` shows until the first frame has decoded.

import React, { useState } from "react";

interface HoverPreviewVideoProps {
  src: string;
  className?: string;
  /** Rendered underneath while the first frame is still decoding. */
  fallback?: React.ReactNode;
}

export default function HoverPreviewVideo({ src, className = "", fallback }: HoverPreviewVideoProps) {
  const [ready, setReady] = useState(false);

  return (
    <>
      {!ready && fallback}
      <video
        src={src}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        onLoadedData={() => setReady(true)}
        className={className}
      />
    </>
  );
}
