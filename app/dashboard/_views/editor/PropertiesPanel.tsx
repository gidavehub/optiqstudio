"use client";

// PropertiesPanel — right rail editing the selected clip: volume, speed,
// fades, mute, and (for clips on video tracks) the overlay transform —
// scale / position / opacity / rotation — which is how an image or picture-
// in-picture video gets shrunk into a corner. Every control dispatches a
// single engine command, so undo/redo covers all of it for free.

import React from "react";
import { Move, RotateCcw, Scissors, SlidersHorizontal, Trash2, Volume2, VolumeX } from "lucide-react";
import { EditorEngine, EditorDoc, DEFAULT_TRANSFORM, clipEnd } from "../../../../lib/editor";

const SPEEDS = [0.5, 1, 1.5, 2] as const;

interface PropertiesPanelProps {
  engine: EditorEngine;
  doc: EditorDoc;
  selectedClipId: string | null;
  onDeselect: () => void;
  playhead: number;
  width: number;
  /** Inside the mobile sheet: fill the sheet instead of a fixed side column. */
  variant?: "panel" | "sheet";
}

export default function PropertiesPanel({ engine, doc, selectedClipId, onDeselect, playhead, width, variant = "panel" }: PropertiesPanelProps) {
  const loc = selectedClipId ? engine.findClip(selectedClipId) : null;
  const isSheet = variant === "sheet";

  return (
    <aside
      style={isSheet ? undefined : { width }}
      className={
        isSheet
          ? "flex w-full flex-col bg-transparent"
          : "flex shrink-0 flex-col border-l border-line bg-surface/85"
      }
    >
      {/* The sheet supplies its own header, so skip the panel one */}
      {!isSheet && (
        <div className="border-b border-line px-3 py-2">
          <span className="flex items-center gap-1.5 text-[9px] font-bold tabular-nums uppercase tracking-widest text-muted">
            <SlidersHorizontal size={10} /> Clip Properties
          </span>
        </div>
      )}

      {!loc ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-line bg-surface text-faint">
            <SlidersHorizontal size={16} />
          </span>
          <p className="text-[10px] leading-relaxed text-faint">
            Select a clip on the timeline to adjust its volume, speed, fades, and overlay size.
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3">
          {(() => {
            const { clip, track } = loc;
            const asset = doc.assets[clip.assetId];
            const isImage = asset?.kind === "image";
            const transform = clip.transform;
            const setTransform = (patch: Partial<NonNullable<typeof transform>>) =>
              engine.setClipProps(clip.id, { transform: { ...DEFAULT_TRANSFORM, ...transform, ...patch } });
            return (
              <>
                {/* Identity */}
                <section className="rounded-2xl border border-line bg-surface p-2.5">
                  <p className="truncate text-[10px] font-bold text-foreground">{clip.label || asset?.label || "Clip"}</p>
                  <p className="mt-1 tabular-nums text-[8px] uppercase tracking-wider text-muted">
                    {track.name} · {clip.start.toFixed(2)}s → {clipEnd(clip).toFixed(2)}s · {clip.duration.toFixed(2)}s
                  </p>
                </section>

                {/* Overlay transform (video tracks only) */}
                {transform && (
                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[9px] font-bold tabular-nums uppercase tracking-wider text-muted">
                        <Move size={10} /> Size & Position
                      </span>
                      <button
                        title="Reset transform"
                        onClick={() => engine.setClipProps(clip.id, { transform: { ...DEFAULT_TRANSFORM } })}
                        className="flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[8px] font-bold text-muted hover:text-foreground hover:bg-surface transition-colors"
                      >
                        <RotateCcw size={9} /> Reset
                      </button>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-[9px] tabular-nums uppercase tracking-wider text-muted">Scale</span>
                        <span className="tabular-nums text-[9px] text-foreground">{Math.round(transform.scale * 100)}%</span>
                      </div>
                      <input
                        type="range" min={0.1} max={2} step={0.01} value={transform.scale}
                        onChange={(e) => setTransform({ scale: Number(e.target.value) })}
                        className="w-full accent-accent h-1"
                      />
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-[9px] tabular-nums uppercase tracking-wider text-muted">Position X</span>
                        <span className="tabular-nums text-[9px] text-foreground">{Math.round(transform.x * 100)}%</span>
                      </div>
                      <input
                        type="range" min={-0.5} max={0.5} step={0.01} value={transform.x}
                        onChange={(e) => setTransform({ x: Number(e.target.value) })}
                        className="w-full accent-accent h-1"
                      />
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-[9px] tabular-nums uppercase tracking-wider text-muted">Position Y</span>
                        <span className="tabular-nums text-[9px] text-foreground">{Math.round(transform.y * 100)}%</span>
                      </div>
                      <input
                        type="range" min={-0.5} max={0.5} step={0.01} value={transform.y}
                        onChange={(e) => setTransform({ y: Number(e.target.value) })}
                        className="w-full accent-accent h-1"
                      />
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-[9px] tabular-nums uppercase tracking-wider text-muted">Opacity</span>
                        <span className="tabular-nums text-[9px] text-foreground">{Math.round(transform.opacity * 100)}%</span>
                      </div>
                      <input
                        type="range" min={0} max={1} step={0.01} value={transform.opacity}
                        onChange={(e) => setTransform({ opacity: Number(e.target.value) })}
                        className="w-full accent-accent h-1"
                      />
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-[9px] tabular-nums uppercase tracking-wider text-muted">Rotation</span>
                        <span className="tabular-nums text-[9px] text-foreground">{Math.round(transform.rotation)}°</span>
                      </div>
                      <input
                        type="range" min={-180} max={180} step={1} value={transform.rotation}
                        onChange={(e) => setTransform({ rotation: Number(e.target.value) })}
                        className="w-full accent-accent h-1"
                      />
                    </div>
                  </section>
                )}

                {/* Volume (not applicable to still images) */}
                {!isImage && (
                  <section>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-[9px] font-bold tabular-nums uppercase tracking-wider text-muted">Volume</span>
                      <span className="tabular-nums text-[9px] text-foreground">{Math.round(clip.volume * 100)}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        title={clip.muted ? "Unmute clip" : "Mute clip"}
                        onClick={() => engine.setClipProps(clip.id, { muted: !clip.muted })}
                        className={`shrink-0 rounded-lg p-1.5 border transition-colors ${
                          clip.muted
                            ? "border-danger bg-danger-soft text-danger"
                            : "border-line bg-surface text-ink-3 hover:text-foreground"
                        }`}
                      >
                        {clip.muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
                      </button>
                      <input
                        type="range"
                        min={0}
                        max={2}
                        step={0.05}
                        value={clip.volume}
                        onChange={(e) => engine.setClipProps(clip.id, { volume: Number(e.target.value) })}
                        className="w-full accent-accent h-1"
                      />
                    </div>
                  </section>
                )}

                {/* Speed */}
                {!isImage && (
                  <section>
                    <span className="mb-1.5 block text-[9px] font-bold tabular-nums uppercase tracking-wider text-muted">
                      Playback Speed
                    </span>
                    <div className="grid grid-cols-4 gap-1">
                      {SPEEDS.map((s) => (
                        <button
                          key={s}
                          onClick={() => engine.setClipSpeed(clip.id, s)}
                          className={`rounded-xl border py-1.5 text-[10px] font-bold transition-colors ${
                            Math.abs(clip.speed - s) < 1e-9
                              ? "border-accent bg-surface text-accent-ink"
                              : "border-line bg-surface text-ink-3 hover:text-foreground"
                          }`}
                        >
                          {s}x
                        </button>
                      ))}
                    </div>
                  </section>
                )}

                {/* Fades */}
                <section className="space-y-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[9px] font-bold tabular-nums uppercase tracking-wider text-muted">Fade In</span>
                      <span className="tabular-nums text-[9px] text-foreground">{clip.fadeIn.toFixed(1)}s</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={3}
                      step={0.1}
                      value={clip.fadeIn}
                      onChange={(e) => engine.setClipProps(clip.id, { fadeIn: Number(e.target.value) })}
                      className="w-full accent-accent h-1"
                    />
                  </div>
                  <div>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[9px] font-bold tabular-nums uppercase tracking-wider text-muted">Fade Out</span>
                      <span className="tabular-nums text-[9px] text-foreground">{clip.fadeOut.toFixed(1)}s</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={3}
                      step={0.1}
                      value={clip.fadeOut}
                      onChange={(e) => engine.setClipProps(clip.id, { fadeOut: Number(e.target.value) })}
                      className="w-full accent-accent h-1"
                    />
                  </div>
                </section>

                {/* Actions */}
                <section className="space-y-1.5 border-t border-line pt-3">
                  <button
                    onClick={() => engine.splitClipAt(clip.id, playhead)}
                    disabled={!(playhead > clip.start && playhead < clipEnd(clip))}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-line bg-surface py-2 text-[10px] font-bold text-ink-2 hover:bg-surface-2 hover:text-foreground disabled:opacity-30 transition-colors"
                  >
                    <Scissors size={11} /> Split at Playhead
                  </button>
                  <button
                    onClick={() => {
                      engine.removeClip(clip.id);
                      onDeselect();
                    }}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-danger bg-danger-soft py-2 text-[10px] font-bold text-danger hover:bg-danger-soft transition-colors"
                  >
                    <Trash2 size={11} /> Delete Clip
                  </button>
                </section>
              </>
            );
          })()}
        </div>
      )}
    </aside>
  );
}
