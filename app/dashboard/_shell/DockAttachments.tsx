"use client";

// The strip of staged references above the dock's tiles. One shape for every
// studio: a square thumbnail per item, a remove button on it, nothing else.
// Audio has no thumbnail worth showing, so it gets the waveform glyph and its
// filename — which is the only thing that identifies one take from another.

import React from "react";
import { Icon } from "../../../components/icons";

export interface DockAttachment {
  id: string;
  kind: "image" | "video" | "audio";
  /** Object URL or data URL. Unused for audio. */
  preview?: string;
  name?: string;
}

export default function DockAttachments({
  items,
  onRemove,
}: {
  items: readonly DockAttachment[];
  onRemove: (id: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="mb-2.5 flex flex-wrap items-center gap-2 sm:mb-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="group relative overflow-hidden rounded-[18px] border border-line-2 bg-surface"
        >
          {item.kind === "image" && item.preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.preview} alt="" className="h-16 w-16 object-cover sm:h-[68px] sm:w-[68px]" />
          )}
          {item.kind === "video" && item.preview && (
            <>
              <video
                src={item.preview}
                muted
                playsInline
                preload="metadata"
                className="h-16 w-16 object-cover sm:h-[68px] sm:w-[68px]"
              />
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-foreground/20 text-background">
                <Icon name="play" size={18} />
              </span>
            </>
          )}
          {item.kind === "audio" && (
            <span className="flex h-16 w-[132px] items-center gap-2 px-3 sm:h-[68px]">
              <Icon name="waveform" size={20} className="text-accent-ink" />
              <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-ink-2">
                {item.name || "Voice reference"}
              </span>
            </span>
          )}

          <button
            type="button"
            onClick={() => onRemove(item.id)}
            aria-label="Remove"
            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-background/90 text-ink-2 transition-colors hover:bg-danger hover:text-white"
          >
            <Icon name="close" size={10} />
          </button>
        </div>
      ))}
    </div>
  );
}
