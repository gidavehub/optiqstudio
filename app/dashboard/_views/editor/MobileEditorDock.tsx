"use client";

// MobileEditorDock — the CapCut-style bottom of the phone editor.
//
// A single horizontally-scrolling tray of big, labelled tools (the way CapCut
// lays out Presets / Filters / Adjust). Nothing is buried in menus: when a clip
// is selected the tray grows the clip tools (Adjust, Split, Duplicate, Delete);
// otherwise it shows the project tools (Add, Split, Undo, Redo). Tools that need
// a value (Add, Adjust) raise a bottom sheet; the rest act instantly. The
// preview and timeline above never move — only this dock changes.

import React, { useState } from "react";
import {
  Copy, Plus, Redo2, Scissors, SlidersHorizontal, Trash2, Undo2, X,
} from "lucide-react";
import {
  EditorEngine, InteractionController, EditorDoc, clipEnd,
} from "../../../../lib/editor";
import MediaBin from "./MediaBin";
import PropertiesPanel from "./PropertiesPanel";

interface MobileEditorDockProps {
  engine: EditorEngine;
  interaction: InteractionController;
  doc: EditorDoc;
  playhead: number;
  project: unknown;
  binWidth: number;
  selectedClipId: string | null;
  onSelect: (id: string | null) => void;
}

type Sheet = "add" | "adjust" | null;

export default function MobileEditorDock({
  engine,
  interaction,
  doc,
  playhead,
  project,
  binWidth,
  selectedClipId,
  onSelect,
}: MobileEditorDockProps) {
  const [sheet, setSheet] = useState<Sheet>(null);
  const hasClip = !!selectedClipId;

  const splitAtPlayhead = () => interaction.razorAllAt(playhead);

  const duplicate = () => {
    if (!selectedClipId) return;
    const loc = engine.findClip(selectedClipId);
    if (!loc) return;
    engine.insertClip(loc.track.id, {
      assetId: loc.clip.assetId,
      start: clipEnd(loc.clip),
      duration: loc.clip.duration,
      srcIn: loc.clip.srcIn,
      speed: loc.clip.speed,
      volume: loc.clip.volume,
      label: loc.clip.label,
    });
  };

  const remove = () => {
    if (!selectedClipId) return;
    engine.removeClip(selectedClipId);
    onSelect(null);
  };

  return (
    <>
      {/* ── TOOL TRAY ─────────────────────────────────────────────────────
          Scrolls sideways; each tool is a thumb-sized target with a label. */}
      <div className="shrink-0 border-t border-white/10 bg-[#0a0f1d] pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-stretch gap-1 overflow-x-auto px-2 py-2.5 scrollbar-none">
          {hasClip ? (
            <>
              <DockTool label="Adjust" onClick={() => setSheet("adjust")} accent>
                <SlidersHorizontal size={18} />
              </DockTool>
              <DockTool label="Split" onClick={splitAtPlayhead}>
                <Scissors size={18} />
              </DockTool>
              <DockTool label="Duplicate" onClick={duplicate}>
                <Copy size={18} />
              </DockTool>
              <DockTool label="Delete" danger onClick={remove}>
                <Trash2 size={18} />
              </DockTool>
              <span className="mx-1 my-2 w-px shrink-0 bg-white/10" />
              <DockTool label="Add" onClick={() => setSheet("add")}>
                <Plus size={18} />
              </DockTool>
              <DockTool label="Done" onClick={() => onSelect(null)}>
                <X size={18} />
              </DockTool>
            </>
          ) : (
            <>
              <DockTool label="Add" accent onClick={() => setSheet("add")}>
                <Plus size={18} />
              </DockTool>
              <DockTool label="Split" onClick={splitAtPlayhead}>
                <Scissors size={18} />
              </DockTool>
              <DockTool label="Undo" disabled={!engine.canUndo()} onClick={() => engine.undo()}>
                <Undo2 size={18} />
              </DockTool>
              <DockTool label="Redo" disabled={!engine.canRedo()} onClick={() => engine.redo()}>
                <Redo2 size={18} />
              </DockTool>
            </>
          )}
        </div>
      </div>

      {/* ── SHEETS ────────────────────────────────────────────────────────── */}
      {sheet && (
        <>
          <button
            aria-label="Close"
            onClick={() => setSheet(null)}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
          />
          <div className="fixed inset-x-0 bottom-0 z-50 animate-slideUp">
            <div className="max-h-[62dvh] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-[#0a0f1d]/95 shadow-[0_-20px_60px_rgba(0,0,0,0.8)] backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/5 bg-[#0a0f1d]/95 px-4 py-2.5">
                <span className="text-[10px] font-bold font-mono uppercase tracking-widest text-neutral-400">
                  {sheet === "add" ? "Add Media" : "Clip Settings"}
                </span>
                <button
                  onClick={() => setSheet(null)}
                  className="rounded-lg bg-white/5 px-3 py-1 text-[11px] font-bold text-neutral-300 transition-transform active:scale-95"
                >
                  Done
                </button>
              </div>

              {sheet === "add" ? (
                <MediaBin project={project} engine={engine} doc={doc} playhead={playhead} width={binWidth} variant="strip" />
              ) : (
                <PropertiesPanel
                  engine={engine}
                  doc={doc}
                  selectedClipId={selectedClipId}
                  onDeselect={() => {
                    onSelect(null);
                    setSheet(null);
                  }}
                  playhead={playhead}
                  width={0}
                  variant="sheet"
                />
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function DockTool({
  children,
  label,
  onClick,
  disabled,
  accent,
  danger,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex w-[62px] shrink-0 flex-col items-center gap-1.5 rounded-xl px-1 py-1.5 transition-transform active:scale-90 disabled:opacity-30"
    >
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition-colors ${
          danger
            ? "border-red-500/30 bg-red-950/30 text-red-400"
            : accent
            ? "border-blue-500/40 bg-[#0c152d] text-blue-400"
            : "border-white/10 bg-white/5 text-neutral-300"
        }`}
      >
        {children}
      </span>
      <span className="text-[9px] font-semibold tracking-tight text-neutral-400">{label}</span>
    </button>
  );
}
