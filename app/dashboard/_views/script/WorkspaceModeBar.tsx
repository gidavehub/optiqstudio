"use client";

// WorkspaceModeBar — the one place that says which face of a project you're
// looking at, and the way to the other two.
//
// It used to be a row of look-alike buttons jammed into the top-right corner,
// different on each face: the render HUD offered "Script Editor", the script
// editor offered "Open Timeline Editor", and neither showed where you actually
// were. Agent, Script and Timeline are three views of one project, so they read
// as a segmented control with the current one filled.
//
// Centred, because that is the only clear space up there — the logo pill owns
// the top-left and the account pill the top-right. Same glass as those, so it
// belongs to the same layer of furniture rather than looking like page content
// that happens to float.

import React from "react";
import { Bot, Edit3, Tv, Undo2 } from "lucide-react";

export type WorkspaceFace = "agent" | "manual" | "auto-merge";

interface WorkspaceModeBarProps {
  /** Which face is on screen. "agent" is a route, the other two are modes. */
  current: WorkspaceFace;
  onAgent: () => void;
  onScript: () => void;
  onTimeline: () => void;
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
  onReset,
  agentRunning = false,
  done,
  total,
}: WorkspaceModeBarProps) {
  const faces: { key: WorkspaceFace; label: string; Icon: typeof Bot; onClick: () => void }[] = [
    { key: "agent", label: "Agent", Icon: Bot, onClick: onAgent },
    { key: "manual", label: "Script", Icon: Edit3, onClick: onScript },
    { key: "auto-merge", label: "Timeline", Icon: Tv, onClick: onTimeline },
  ];

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-30 flex justify-center px-3 sm:top-4">
      <div className="glass pointer-events-auto flex items-center gap-1 rounded-full px-1.5 py-1.5">
        {faces.map(({ key, label, Icon, onClick }) => {
          const active = current === key;
          return (
            <button
              key={key}
              onClick={onClick}
              title={label}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 sm:px-3.5 ${
                active
                  ? "bg-foreground text-background"
                  : "text-ink-3 hover:bg-surface-2 hover:text-foreground"
              } ${key === "agent" && agentRunning && !active ? "animate-pulse text-accent-ink" : ""}`}
            >
              <Icon size={13} className="shrink-0" />
              {/* The label on the active tab always shows — that is the whole
                  point of the bar. The other two collapse to icons on phones. */}
              <span className={active ? "" : "hidden sm:inline"}>{label}</span>
            </button>
          );
        })}

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
