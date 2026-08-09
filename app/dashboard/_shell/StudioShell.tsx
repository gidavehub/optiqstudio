"use client";

// StudioShell — the frame every creation surface now sits in.
//
//   ┌──────────────────────────────────────────────┐
//   │  ╭────────────────────────────────────────╮  │  floating island
//   │  ╰────────────────────────────────────────╯  │
//   │  ╭──────────╮ ╭───────────────────────────╮  │
//   │  │   RAIL   │ │   the wall of work        │  │  rail = one third
//   │  ╰──────────╯ ╰───────────────────────────╯  │
//   │  ╭────╮╭────╮╭────╮╭────╮                    │  four big tiles
//   │  ╭──────────────────────────────────╮  ( ➤ ) │  input + send
//   └──────────────────────────────────────────────┘
//
// Three fixed regions and one scrolling one. The island floats over the wall
// (it does not push it down), the rail and the dock never scroll, and the wall
// is the only thing that moves. That means the controls that matter are always
// in the same place no matter how much work is on the screen — which is the
// entire complaint this rebuild answers.
//
// Below `lg` the rail is a sheet instead of a column, because a third of a
// phone is not a third of a desktop. Nothing else changes shape.

import React, { useRef, useState } from "react";
import { useIsMobile } from "../_shared/useIsMobile";
import { Icon } from "../../../components/icons";
import StudioIsland from "./StudioIsland";
import type { NavItem, ShellHelpers } from "./types";

interface StudioShellProps {
  /** Destinations in the island. Usually STUDIO_NAV. */
  navItems: readonly NavItem[];
  activeId: string;
  /** What this screen is, in two or three words. */
  title: string;
  /** The bold left third. */
  rail: React.ReactNode;
  /** Names the rail on the island's phone button and the sheet header. */
  railLabel?: string;
  /** The whole bottom, given the shell's own controls to drive. */
  dock: (helpers: ShellHelpers) => React.ReactNode;
  /** Files dropped anywhere on the studio. Omit and dropping is ignored. */
  onDropFiles?: (files: File[]) => void;
  /** One line shown over the drop overlay, e.g. what the files will be used as. */
  dropHint?: string;
  /** The wall. The only region that scrolls. */
  children: React.ReactNode;
}

export default function StudioShell({
  navItems,
  activeId,
  title,
  rail,
  railLabel = "Setup",
  dock,
  onDropFiles,
  dropHint = "Drop it anywhere",
  children,
}: StudioShellProps) {
  // The rail is a real column from lg up and a sheet below it, so "open" only
  // means anything on the narrow side.
  const railIsSheet = useIsMobile("(max-width: 1023px)");
  const [sheetOpen, setSheetOpen] = useState(false);
  const open = railIsSheet && sheetOpen;

  // The WHOLE studio is the drop target now, not a 40px strip inside the input
  // bar. Depth counter rather than a boolean: dragging over a child fires
  // dragleave on the parent, and a boolean flickers the overlay off mid-drag.
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const endDrag = () => {
    dragDepth.current = 0;
    setDragging(false);
  };

  const helpers: ShellHelpers = {
    openRail: () => setSheetOpen(true),
    railOpen: open,
  };

  return (
    <div
      className="relative flex h-full flex-col overflow-hidden bg-background text-foreground"
      onDragEnter={
        onDropFiles
          ? (e) => {
              e.preventDefault();
              dragDepth.current += 1;
              setDragging(true);
            }
          : undefined
      }
      onDragOver={onDropFiles ? (e) => e.preventDefault() : undefined}
      onDragLeave={
        onDropFiles
          ? () => {
              dragDepth.current -= 1;
              if (dragDepth.current <= 0) endDrag();
            }
          : undefined
      }
      onDrop={
        onDropFiles
          ? (e) => {
              e.preventDefault();
              endDrag();
              onDropFiles(Array.from(e.dataTransfer.files || []));
            }
          : undefined
      }
    >
      <StudioIsland
        items={navItems}
        activeId={activeId}
        title={title}
        onOpenRail={() => setSheetOpen((v) => !v)}
        railLabel={railLabel}
        railOpen={open}
      />

      {/* Island clearance is padding on the scroll region, not a spacer row —
          the wall passes UNDER the island as it scrolls, which is what makes
          the island read as floating rather than as a header. */}
      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden px-3 pt-[84px] sm:gap-4 sm:px-5 sm:pt-[96px]">
        <aside className="hidden w-[32%] min-w-[280px] max-w-[400px] shrink-0 overflow-y-auto rounded-[28px] border border-line-2 bg-surface p-4 lg:block">
          <div className="space-y-6">{rail}</div>
        </aside>

        <div className="min-w-0 flex-1 overflow-y-auto pb-2">{children}</div>
      </div>

      {dock(helpers)}

      {dragging && (
        <div className="pointer-events-none absolute inset-3 z-50 flex flex-col items-center justify-center gap-3 rounded-[32px] border-[3px] border-dashed border-foreground bg-background/85 backdrop-blur-sm sm:inset-5">
          <Icon name="upload" size={40} className="animate-bounce-subtle text-foreground" />
          <span className="text-[20px] font-bold tracking-tight text-foreground">{dropHint}</span>
        </div>
      )}

      {/* ── The rail, as a sheet ── */}
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden">
          <button
            aria-label="Close"
            onClick={() => setSheetOpen(false)}
            className="absolute inset-0 bg-foreground/25 backdrop-blur-sm"
          />
          <div className="animate-slideUp relative max-h-[76vh] overflow-y-auto rounded-t-[32px] border-t border-line-2 bg-background p-4 pb-8">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-[18px] font-bold tracking-tight text-foreground">{railLabel}</h2>
              <button
                onClick={() => setSheetOpen(false)}
                aria-label="Done"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-ink-2 transition-colors hover:bg-surface-3 hover:text-foreground active:scale-95"
              >
                <Icon name="close" size={16} />
              </button>
            </div>
            <div className="space-y-6">{rail}</div>
          </div>
        </div>
      )}
    </div>
  );
}
