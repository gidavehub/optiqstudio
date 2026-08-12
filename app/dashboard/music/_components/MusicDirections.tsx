"use client";

// The score director's answers, in the rail.
//
// Three directions, each a card you can read across the room: what it's called,
// why it suits the brief, and the hard facts underneath — tempo, key, what's
// actually playing. Tapping one loads its brief into the box; Compose does the
// rest. Nothing here charges anything.

import React from "react";
import { Icon } from "../../../../components/icons";

export interface MusicDirection {
  name: string;
  pitch: string;
  tempo: string;
  key: string;
  instruments: string[];
  brief: string;
}

export default function MusicDirections({
  directions,
  busy,
  activeName,
  onUse,
}: {
  directions: readonly MusicDirection[];
  busy: boolean;
  /** The direction currently loaded in the box. */
  activeName: string | null;
  onUse: (d: MusicDirection) => void;
}) {
  if (busy) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-[22px] border border-line-2 bg-background px-4 py-10 text-center">
        <Icon name="agent" size={30} className="animate-spin text-accent-ink" />
        <p className="text-[14px] font-bold tracking-tight text-foreground">Finding three ways in…</p>
        <p className="text-[12px] font-semibold text-muted">
          The director is scoring your brief three different ways.
        </p>
      </div>
    );
  }

  if (directions.length === 0) {
    return (
      <div className="rounded-[22px] border border-line-2 bg-background px-4 py-8 text-center">
        <Icon name="agent" size={28} className="mx-auto text-faint" />
        <p className="mt-3 text-[14px] font-bold tracking-tight text-foreground">
          Don&apos;t know what it should sound like?
        </p>
        <p className="mt-1.5 text-[12px] font-semibold leading-relaxed text-muted">
          Write the scene, not the score — then hit Direct and pick from three.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {directions.map((d) => {
        const active = d.name === activeName;
        return (
          <button
            key={d.name}
            type="button"
            onClick={() => onUse(d)}
            className={`block w-full rounded-[22px] border p-4 text-left transition-all active:scale-[0.99] ${
              active
                ? "border-transparent bg-foreground text-background"
                : "border-line-2 bg-background text-foreground hover:border-foreground hover:bg-surface-2"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="min-w-0 text-[17px] font-bold leading-tight tracking-tight">{d.name}</h3>
              <Icon
                name={active ? "checkCircle" : "arrowUpRight"}
                size={18}
                className={active ? "" : "text-ink-3"}
              />
            </div>
            <p className={`mt-1.5 text-[12px] font-semibold leading-relaxed ${active ? "opacity-75" : "text-muted"}`}>
              {d.pitch}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[d.tempo, d.key, ...d.instruments.slice(0, 3)].filter(Boolean).map((chip) => (
                <span
                  key={chip}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    active ? "bg-background/20 text-background" : "bg-surface-2 text-ink-2"
                  }`}
                >
                  {chip}
                </span>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
