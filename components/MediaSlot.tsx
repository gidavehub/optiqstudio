"use client";

import React, { useState } from "react";

/**
 * Renders a video or image from /public/media, falling back to a solid panel
 * until the generated asset exists (assets are produced by
 * scripts/generate-assets.mjs via Vertex AI).
 */
export default function MediaSlot({
  src,
  poster,
  kind = "video",
  className = "",
  alt = "",
}: {
  src: string;
  poster?: string;
  kind?: "video" | "image";
  className?: string;
  alt?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <div className={`media-fallback ${className}`} aria-label={alt} />;
  }

  if (kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className={`object-cover ${className}`}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <video
      className={`object-cover ${className}`}
      src={src}
      poster={poster}
      autoPlay
      muted
      loop
      playsInline
      onError={() => setFailed(true)}
    />
  );
}
