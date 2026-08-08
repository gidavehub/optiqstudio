"use client";

// WorkspaceModeBar — the way OUT of the face you're on, to the other two.
//
// It shows only the faces you are NOT on. It used to render all three with the
// current one filled, as a "you are here" indicator, which turned out to be a
// button that does nothing sitting where a useful one could be — you already know
// which screen you're looking at.
//
// WHERE IT APPEARS: only on faces that have no navbar of their own. That is the
// script editor and the render HUD. The timeline editor and the agent room both
// carry their own top bar and put these two destinations in it, so a floating bar
// there is a second navigation control competing with the first.
//
// Centred, because that is the only clear space up there — the logo pill owns
// the top-left and the account pill the top-right. Same glass as those, so it
// belongs to the same layer of furniture rather than looking like page content
// that happens to float.

import React from "react";
import { Edit3, Images, Tv, Undo2 } from "lucide-react";
import OptiqMark from "../../../../components/OptiqMark";

export type WorkspaceFace = "agent" | "manual" | "auto-merge" | "board";

interface WorkspaceModeBarProps {
  /** Which face is on screen. "agent" is a route, the other two are modes. */
  current: WorkspaceFace;
  onAgent: () => void;
  onScript: () => void;
  onTimeline: () => void;
  onBoard: () => void;
  onReset?: () => void;
  /** Pulses the agent tab while a turn is rewriting the film server-side. */
  agentRunning?: boolean;
  /** Scenes rendered / total, shown as a quiet tally beside the switcher. */
  done?: number;
  total?: number;
}

export default function WorkspaceModeBar({
  current,
  onAgent,
  onScript,
  onTimeline,
  onBoard,
  onReset,
  agentRunning = false,
  done,
  total,
}: WorkspaceModeBarProps) {
  // The agent's icon is the Optiq Studio mark itself, not a generic robot: this
  // face IS the product talking, and the mark is what the director already
  // associates with it from the chrome and the tab icon.
  interface Face {
    key: WorkspaceFace;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
  }

  const ALL_FACES: Face[] = [
    { key: "agent", label: "Optiq Agent", icon: <OptiqMark size={13} />, onClick: onAgent },
    { key: "manual", label: "Script", icon: <Edit3 size={13} className="shrink-0" />, onClick: onScript },
    { key: "auto-merge", label: "Timeline", icon: <Tv size={13} className="shrink-0" />, onClick: onTimeline },
    { key: "board", label: "Board", icon: <Images size={13} className="shrink-0" />, onClick: onBoard },
  ];

  // Only the ways OUT. The face you're on is not a destination.
  const faces = ALL_FACES.filter((face) => face.key !== current);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-30 flex justify-center px-3 sm:top-4">
      <div className="glass pointer-events-auto flex max-w-full items-center gap-1 overflow-x-auto scrollbar-none rounded-full px-1.5 py-1.5">
        {/* Three destinations now the board is one of them. Still labelled
            rather than collapsed to icons — the pill scrolls sideways on a
            narrow phone instead, which beats guessing at a glyph. */}
        {faces.map(({ key, label, icon, onClick }) => (
          <button
            key={key}
            onClick={onClick}
            title={label}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold text-ink-3 transition-all hover:bg-surface-2 hover:text-foreground active:scale-95 sm:px-3.5 ${
              key === "agent" && agentRunning ? "animate-pulse text-accent-ink" : ""
            }`}
          >
            {icon}
            {label}
          </button>
        ))}

        {typeof done === "number" && typeof total === "number" && (
          <span className="ml-1 border-l border-line-2 pl-2.5 pr-1 tabular-nums text-[11px] font-bold text-ink-3">
            {done}
            <span className="text-faint"> / {total}</span>
          </span>
        )}

        {onReset && (
          <button
            onClick={onReset}
            title="Reset draft"
            aria-label="Reset draft"
            className="ml-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-foreground active:scale-95"
          >
            <Undo2 size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
