"use client";

// DirectionPanel — the film-wide locks: the character block, the visual style
// contract and the music spec. On desktop this sits above the scene list; on
// mobile it is page one of the deck.

import React from "react";
import { Music } from "lucide-react";
import { Storyboard } from "../../_flow/types";

interface DirectionPanelProps {
  storyboard: Storyboard;
  setStoryboard: React.Dispatch<React.SetStateAction<Storyboard | null>>;
  /** One column instead of two (mobile deck). */
  stacked?: boolean;
}

export default function DirectionPanel({ storyboard, setStoryboard, stacked = false }: DirectionPanelProps) {
  const patch = (next: Partial<Storyboard>) =>
    setStoryboard((prev) => (prev ? { ...prev, ...next } : prev));

  return (
    <div className="space-y-5">
      <div className={`grid gap-5 ${stacked ? "grid-cols-1" : "grid-cols-1 lg:grid-cols-2"}`}>
        <div className="flex flex-col rounded-3xl border border-line bg-surface/80 p-5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
            Locked character block
          </span>
          <p className="mb-3 mt-1 text-[11px] leading-relaxed text-muted">
            Keeps the face and physical geometry identical, verbatim, across every scene.
          </p>
          <textarea
            value={storyboard.characterLock.description}
            onChange={(e) =>
              patch({ characterLock: { ...storyboard.characterLock, description: e.target.value } })
            }
            rows={4}
            className="w-full rounded-2xl border border-line bg-background p-3.5 font-mono text-xs leading-relaxed text-foreground outline-none focus:border-accent-line"
          />
          <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <span className="text-[9px] font-bold uppercase text-muted">Actor subject</span>
              <input
                value={storyboard.characterLock.name}
                onChange={(e) =>
                  patch({ characterLock: { ...storyboard.characterLock, name: e.target.value } })
                }
                className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-1.5 text-xs font-semibold text-foreground outline-none focus:border-accent-line"
              />
            </div>
            <div>
              <span className="text-[9px] font-bold uppercase text-muted">Locked wardrobe</span>
              <input
                value={storyboard.characterLock.wardrobe}
                onChange={(e) =>
                  patch({ characterLock: { ...storyboard.characterLock, wardrobe: e.target.value } })
                }
                className="mt-1 w-full rounded-xl border border-line bg-background px-3 py-1.5 text-xs font-semibold text-foreground outline-none focus:border-accent-line"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col rounded-3xl border border-line bg-surface/80 p-5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
            Visual style contract
          </span>
          <p className="mb-3 mt-1 text-[11px] leading-relaxed text-muted">
            Optics, lens and grain, applied identically to every output.
          </p>
          <textarea
            value={storyboard.styleHeader}
            onChange={(e) => patch({ styleHeader: e.target.value })}
            rows={6}
            className="w-full flex-1 rounded-2xl border border-line bg-background p-3.5 font-mono text-xs leading-relaxed text-foreground outline-none focus:border-accent-line"
          />
        </div>
      </div>

      {storyboard.musicSpec !== undefined && storyboard.musicSpec !== null && (
        <div className="rounded-[28px] border border-line bg-surface/80 p-5">
          <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-foreground">
            <Music size={12} className="text-accent-ink" /> Locked background music spec
          </span>
          <p className="mb-3 mt-1 text-[11px] leading-relaxed text-muted">
            Carried verbatim through every continuous scene so the whole ad sounds like one track.
          </p>
          <textarea
            value={storyboard.musicSpec}
            onChange={(e) => patch({ musicSpec: e.target.value })}
            rows={3}
            className="max-h-32 w-full resize-none overflow-y-auto rounded-2xl border border-line bg-background p-3.5 font-mono text-xs leading-relaxed text-foreground outline-none focus:border-accent-line"
          />
        </div>
      )}
    </div>
  );
}
