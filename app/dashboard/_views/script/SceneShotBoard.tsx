"use client";

// SceneShotBoard — the scene's camera setups, photographed.
//
// This is the storyboard in the old sense: one still per angle, in time order,
// and those exact stills are what the render is built from (see
// app/dashboard/_flow/shotBoard.ts). So the strip is not decoration — it is a
// preview of the clip's own frames, and it is the last place a wrong room, a
// swapped seat or a changed document can be caught before a render is paid for.
//
// Shared by the desktop scene card and the mobile deck.

import React, { useState } from "react";
import { Camera, RefreshCw } from "lucide-react";
import { ShotFrame } from "../../_flow/types";
import { aspectStyle } from "../../_shared/aspect";

interface SceneShotBoardProps {
  /** Every setup the scene has, photographed or not, in shot order. */
  setups: ShotFrame[];
  /** The film's shape — the frames were shot in it, so the strip shows it. */
  aspect?: string | null;
  /** True while a shot-board pass is running anywhere on this film. */
  busy: boolean;
  /** One line of live status, from shotBoardStatusLabel(). */
  status: string;
  /** `keepDesign` re-shoots these setups; without it the scene is re-covered. */
  onPhotograph: (keepDesign: boolean) => void;
}

/**
 * The strip shows one thumbnail per ATTACHED STILL, not per setup.
 *
 * A setup whose camera travels is photographed twice — where it starts and where
 * it arrives — and both stills ride along with the render. Drawing only the
 * opening frame would hide half of what the clip is actually built from, which
 * is the one thing this strip exists to prevent.
 */
function stripStills(setups: ShotFrame[]) {
  const stills: { setup: ShotFrame; url?: string; ends: boolean }[] = [];
  for (const setup of setups) {
    stills.push({ setup, url: setup.url, ends: false });
    if (setup.end?.url) stills.push({ setup, url: setup.end.url, ends: true });
  }
  return stills;
}

export default function SceneShotBoard({ setups, aspect, busy, status, onPhotograph }: SceneShotBoardProps) {
  const [selected, setSelected] = useState(0);
  const stills = stripStills(setups);
  const current = stills[Math.min(selected, Math.max(stills.length - 1, 0))];
  const shot = current?.setup;
  const photographed = setups.filter((s) => s.url).length;

  return (
    <div className="rounded-[28px] border border-line bg-surface p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[9px] font-bold uppercase tracking-wide text-muted">
          {setups.length > 0
            ? `Shot board — ${setups.length} ${setups.length === 1 ? "setup" : "setups"}, and this clip's own frames`
            : "Shot board"}
        </span>
        {setups.length > 0 && (
          <button
            onClick={() => onPhotograph(true)}
            disabled={busy}
            title="Photograph these setups again, without re-cutting the scene"
            className="flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[10px] font-bold text-ink-3 transition-colors hover:border-accent-line hover:text-accent-ink disabled:opacity-40"
          >
            <RefreshCw size={10} className={busy ? "animate-spin" : ""} />
            Re-shoot
          </button>
        )}
      </div>

      {setups.length === 0 ? (
        // No call to action here. The board builds itself behind every film, so
        // an empty strip means "not yet", not "you forgot to press something" —
        // and a button that says otherwise makes the automatic path look broken.
        // The one manual trigger a film ever needs is the film-wide bar above.
        <p className="mt-2.5 text-[11px] text-ink-3">{busy ? status : "Not photographed yet."}</p>
      ) : (
        <>
          <div className="mt-2.5 flex gap-2 overflow-x-auto scrollbar-none">
            {stills.map(({ setup, url, ends }, i) => (
              <button
                key={`${setup.id || `${setup.order}-${setup.time}`}${ends ? "-end" : ""}`}
                onClick={() => setSelected(i)}
                title={ends ? `${setup.label} — where it ends` : setup.label}
                style={aspectStyle(aspect)}
                className={`relative w-28 shrink-0 overflow-hidden rounded-2xl border bg-background transition-colors sm:w-32 ${
                  i === selected ? "border-accent-line" : "border-line hover:border-line-2"
                }`}
              >
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={setup.label} className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-muted">
                    <Camera size={14} className={busy ? "animate-pulse" : ""} />
                  </span>
                )}
                <span className="absolute bottom-1 left-1 rounded-full bg-background/85 px-1.5 py-0.5 text-[9px] font-bold text-ink-2 backdrop-blur-sm">
                  {ends ? "ends on" : setup.time}
                </span>
              </button>
            ))}
          </div>

          {shot && (
            <div className="mt-2.5 space-y-1 rounded-2xl border border-line bg-background px-3 py-2.5">
              <p className="text-[11px] font-bold text-foreground">{shot.label}</p>
              <p className="text-[11px] leading-relaxed text-ink-3">{shot.camera}</p>
              <p className="text-[11px] leading-relaxed text-ink-3">{shot.blocking}</p>
              <p className="text-[10px] text-muted">
                {shot.entry === "held-then-moves" ? "Holds, then " : "Straight in — "}
                {shot.motion}
                {shot.cameraMove && shot.cameraMove !== "locked"
                  ? ` · camera ${shot.cameraMove.replace(/-/g, " ")}`
                  : ""}
              </p>
            </div>
          )}

          {(busy || photographed < setups.length) && (
            <p className="mt-2 text-[10px] text-muted">
              {busy ? status : `${photographed} of ${setups.length} photographed — re-shoot to fill the rest.`}
            </p>
          )}
        </>
      )}
    </div>
  );
}
