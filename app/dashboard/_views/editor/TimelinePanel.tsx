"use client";

// TimelinePanel — multi-track timeline: ruler, draggable playhead, clips with
// move/trim/razor gestures, magnetic snapping, and gesture-born layers.
//
// Drag physics (CapCut model): grabbing a clip lifts it into a GHOST that
// follows the pointer freely across the whole 2D plane of the timeline. While
// hovering, the drop target is resolved live:
//   · free space on a compatible lane  → the clip will land right there;
//   · occupied space on a lane         → a slot row animates open ABOVE that
//     track ("a space opens up") and dropping materializes it into a new
//     layer with the clip inside;
//   · anywhere illegal (image → audio, off the tracks) → nothing highlights
//     and releasing springs the clip back to where it was.
// Nothing mutates during the hover — the document changes only on drop, as a
// single undo step. Media dragged from the bin follows the same rules, and
// tracks that end a gesture empty are pruned automatically.

import React, { useRef, useState } from "react";
import { Clapperboard, Image as ImageIcon, Music, Volume2, VolumeX, Lock, Unlock } from "lucide-react";
import {
  EditorEngine, InteractionController, EditorDoc, Track, Clip, AssetKind, clipEnd, rulerTicks,
} from "../../../../lib/editor";
import { EditorTool } from "./EditorStudio";
import {
  MEDIA_DRAG_TYPE, MediaPayload, createLayerTrack, findOrAddAsset, getActiveDragPayload,
  payloadDuration, placeMediaOnTimeline, pruneEmptyTracks, regionFree, withDuration,
} from "./placement";

const HEADER_W = 116;
const ROW_H = 54;
const SLOT_H = 44;
const RULER_H = 26;
const EDGE_PX = 7;

interface TimelinePanelProps {
  engine: EditorEngine;
  interaction: InteractionController;
  doc: EditorDoc;
  pps: number;
  playhead: number;
  height: number;
  tool: EditorTool;
  selectedClipId: string | null;
  onSelect: (id: string | null) => void;
  onSeek: (t: number) => void;
}

/** Where the current drag would land if released right now. */
type DropTarget =
  | { type: "lane"; trackId: string; start: number }
  | { type: "slot"; refTrackId: string; start: number }
  | null;

interface GhostDrag {
  clipId: string;
  assetKind: AssetKind;
  trackKind: Track["kind"];
  duration: number;
  label: string;
  /** Ghost position in content coordinates. */
  x: number;
  y: number;
  target: DropTarget;
}

interface BinDragState {
  payload: MediaPayload;
  target: DropTarget;
}

export default function TimelinePanel({
  engine, interaction, doc, pps, playhead, height, tool, selectedClipId, onSelect, onSeek,
}: TimelinePanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const laneRefs = useRef(new Map<string, HTMLDivElement>());
  const slotRefs = useRef(new Map<string, HTMLDivElement>());
  const dragRef = useRef<null | {
    mode: "move" | "trim-start" | "trim-end";
    clipId: string;
    moved: boolean;
    startX: number;
    grabOffset: number;
    duration: number;
  }>(null);
  const scrubRef = useRef(false);
  const [ghost, setGhost] = useState<GhostDrag | null>(null);
  const [binDrag, setBinDrag] = useState<BinDragState | null>(null);

  // Display order: video layers top-first (highest overlay at the top row),
  // then audio tracks. doc.tracks itself stays bottom→top for the renderer.
  const videoTracks = doc.tracks.filter((t) => t.kind === "video");
  const audioTracks = doc.tracks.filter((t) => t.kind === "audio");
  const displayTracks = [...videoTracks.slice().reverse(), ...audioTracks];

  const contentWidth = Math.max(doc.duration * pps + 480, 900);
  const ticks = rulerTicks({ pxPerSecond: pps, scrollX: 0 }, contentWidth, doc.duration + 8);

  const contentTime = (clientX: number): number => {
    const rect = contentRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.max(0, (clientX - rect.left - HEADER_W) / pps);
  };

  const contentY = (clientY: number): number => {
    const rect = contentRef.current?.getBoundingClientRect();
    return rect ? clientY - rect.top : 0;
  };

  const trackUnderPointer = (clientY: number): string | undefined => {
    for (const [id, el] of laneRefs.current) {
      const r = el.getBoundingClientRect();
      if (clientY >= r.top && clientY <= r.bottom) return id;
    }
    return undefined;
  };

  /** The open slot row under the pointer, if any (they have height only while open). */
  const slotUnderPointer = (clientY: number): string | undefined => {
    for (const [id, el] of slotRefs.current) {
      const r = el.getBoundingClientRect();
      if (r.height > 8 && clientY >= r.top && clientY <= r.bottom) return id;
    }
    return undefined;
  };

  const snap = (t: number, ignoreClipId?: string): number => {
    const threshold = 8 / pps;
    return engine.snapTime(Math.max(0, t), { threshold, ignoreClipId, extra: [playhead] });
  };

  /**
   * Shared target resolution for both drag flavors: given the pointer, the
   * dragged media's lane kind + asset kind + duration, decide lane / slot /
   * nothing. `ignoreClipId` frees the dragged clip's own footprint.
   */
  const resolveTarget = (
    clientX: number,
    clientY: number,
    desiredStart: number,
    duration: number,
    laneKind: Track["kind"],
    assetKind: AssetKind,
    ignoreClipId?: string,
    currentTarget?: DropTarget
  ): DropTarget => {
    // An open slot keeps the hover as long as the pointer stays inside it.
    const overSlot = slotUnderPointer(clientY);
    if (overSlot && currentTarget?.type === "slot" && currentTarget.refTrackId === overSlot) {
      return { type: "slot", refTrackId: overSlot, start: snap(desiredStart, ignoreClipId) };
    }

    const overTrackId = trackUnderPointer(clientY);
    if (!overTrackId) return null;
    const track = engine.getTrack(overTrackId);
    if (!track || track.locked) return null;

    // Legality: images can never live on audio lanes; audio payloads can
    // never live on video lanes. (A video clip CAN drop onto audio — that's
    // the audio-extraction gesture.)
    if (track.kind === "audio" && assetKind === "image") return null;
    if (track.kind === "video" && laneKind === "audio" && assetKind === "audio") return null;

    const start = snap(desiredStart, ignoreClipId);
    if (regionFree(track, start, duration, ignoreClipId)) {
      return { type: "lane", trackId: track.id, start };
    }
    return { type: "slot", refTrackId: track.id, start };
  };

  const activeSlotTrackId =
    (ghost?.target?.type === "slot" ? ghost.target.refTrackId : undefined) ??
    (binDrag?.target?.type === "slot" ? binDrag.target.refTrackId : undefined);
  const activeSlotStart =
    ghost?.target?.type === "slot" ? ghost.target.start
    : binDrag?.target?.type === "slot" ? binDrag.target.start
    : 0;
  const activeSlotWidth = ghost
    ? ghost.duration * pps
    : binDrag
      ? payloadDuration(binDrag.payload) * pps
      : 0;

  // ── Clip gestures ──────────────────────────────────────────────────────
  const onClipPointerDown = (e: React.PointerEvent, track: Track, clip: Clip) => {
    e.stopPropagation();
    const t = contentTime(e.clientX);

    if (tool === "razor") {
      engine.splitClipAt(clip.id, t);
      return;
    }

    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    const local = e.clientX - rect.left;
    let mode: "move" | "trim-start" | "trim-end" = "move";
    if (local <= EDGE_PX) mode = "trim-start";
    else if (local >= rect.width - EDGE_PX) mode = "trim-end";

    el.setPointerCapture(e.pointerId);
    dragRef.current = {
      mode, clipId: clip.id, moved: false, startX: e.clientX,
      grabOffset: t - clip.start, duration: clip.duration,
    };
    // Trims keep the engine-transaction path; moves become a pure ghost drag
    // (no document mutation until the drop).
    if (mode !== "move") interaction.beginTrim(clip.id, mode === "trim-start" ? "start" : "end");
  };

  const onClipPointerMove = (e: React.PointerEvent, track: Track, clip: Clip) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (Math.abs(e.clientX - drag.startX) > 3) drag.moved = true;
    if (!drag.moved) return;

    if (drag.mode !== "move") {
      interaction.update(contentTime(e.clientX));
      return;
    }

    const asset = doc.assets[clip.assetId];
    const pointerTime = contentTime(e.clientX);
    const desiredStart = Math.max(0, pointerTime - drag.grabOffset);
    setGhost((prev) => ({
      clipId: clip.id,
      assetKind: asset?.kind ?? "video",
      trackKind: track.kind,
      duration: drag.duration,
      label: clip.label || asset?.label || "Clip",
      x: desiredStart * pps,
      y: contentY(e.clientY),
      target: resolveTarget(
        e.clientX, e.clientY, desiredStart, drag.duration,
        track.kind, asset?.kind ?? "video", clip.id, prev?.target
      ),
    }));
  };

  const onClipPointerUp = (e: React.PointerEvent, clip: Clip) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;

    if (drag.mode !== "move") {
      if (drag.moved) interaction.end();
      else interaction.cancel();
      if (!drag.moved) onSelect(clip.id === selectedClipId ? null : clip.id);
      return;
    }

    const g = ghost;
    setGhost(null);
    if (!drag.moved) {
      onSelect(clip.id === selectedClipId ? null : clip.id);
      return;
    }

    const target = g?.target ?? null;
    try {
      if (target?.type === "lane") {
        engine.moveClip(drag.clipId, { trackId: target.trackId, start: target.start }, "reject");
      } else if (target?.type === "slot") {
        engine.beginTransient();
        const newTrackId = createLayerTrack(engine, target.refTrackId);
        if (newTrackId) engine.moveClip(drag.clipId, { trackId: newTrackId, start: target.start }, "reject");
        engine.commitTransient();
      }
      // target === null → spring back: the document was never touched.
    } catch {
      engine.cancelTransient();
    }
    pruneEmptyTracks(engine);
  };

  // ── Media-bin drops (native DnD) ───────────────────────────────────────
  const isMediaDrag = (e: React.DragEvent) => e.dataTransfer.types.includes(MEDIA_DRAG_TYPE);

  const onBinDragOver = (e: React.DragEvent) => {
    if (!isMediaDrag(e)) return;
    e.preventDefault();
    const payload = getActiveDragPayload();
    if (!payload) {
      e.dataTransfer.dropEffect = "copy";
      return;
    }
    e.dataTransfer.dropEffect = "copy";
    const duration = payloadDuration(payload);
    const desiredStart = contentTime(e.clientX);
    setBinDrag((prev) => ({
      payload,
      target: resolveTarget(
        e.clientX, e.clientY, desiredStart, duration,
        payload.kind === "audio" ? "audio" : "video", payload.kind,
        undefined, prev?.target
      ),
    }));
  };

  const onBinDrop = async (e: React.DragEvent) => {
    if (!isMediaDrag(e)) return;
    e.preventDefault();
    const state = binDrag;
    setBinDrag(null);
    let payload: MediaPayload;
    try {
      payload = JSON.parse(e.dataTransfer.getData(MEDIA_DRAG_TYPE));
    } catch {
      return;
    }
    const target = state?.target ?? null;
    const resolved = await withDuration(payload);
    try {
      if (target?.type === "slot") {
        engine.beginTransient();
        const newTrackId = createLayerTrack(engine, target.refTrackId);
        if (newTrackId) {
          const assetId = findOrAddAsset(engine, resolved);
          engine.insertClip(newTrackId, {
            assetId,
            start: target.start,
            duration: resolved.kind === "image" ? payloadDuration(resolved) : undefined,
            label: resolved.label,
            overlap: "reject",
          });
        }
        engine.commitTransient();
      } else if (target?.type === "lane") {
        placeMediaOnTimeline(engine, resolved, target.start, target.trackId);
      } else {
        placeMediaOnTimeline(engine, resolved, contentTime(e.clientX));
      }
    } catch {
      engine.cancelTransient();
    }
    pruneEmptyTracks(engine);
  };

  // ── Ruler scrubbing ────────────────────────────────────────────────────
  const rulerSeek = (e: React.PointerEvent) => {
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    onSeek(Math.max(0, (e.clientX - rect.left) / pps));
  };

  const laneHighlightId =
    (ghost?.target?.type === "lane" ? ghost.target.trackId : undefined) ??
    (binDrag?.target?.type === "lane" ? binDrag.target.trackId : undefined);
  const laneHighlightStart =
    ghost?.target?.type === "lane" ? ghost.target.start
    : binDrag?.target?.type === "lane" ? binDrag.target.start
    : 0;
  const laneHighlightWidth = ghost
    ? ghost.duration * pps
    : binDrag
      ? payloadDuration(binDrag.payload) * pps
      : 0;

  return (
    <div style={{ height }} className="shrink-0 border-t border-white/5 bg-[#080d1a]">
      <div
        ref={scrollRef}
        className="h-full overflow-auto"
        onDragOver={onBinDragOver}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setBinDrag(null);
        }}
        onDrop={(e) => void onBinDrop(e)}
      >
        <div ref={contentRef} style={{ width: contentWidth + HEADER_W }} className="relative min-h-full pb-8">
          {/* ── Ruler row ── */}
          <div className="sticky top-0 z-30 flex" style={{ height: RULER_H }}>
            <div
              className="sticky left-0 z-40 shrink-0 border-b border-r border-white/5 bg-[#0a0f1d]"
              style={{ width: HEADER_W }}
            />
            <div
              className="relative flex-1 cursor-col-resize border-b border-white/5 bg-[#0a0f1d]"
              onPointerDown={(e) => {
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                scrubRef.current = true;
                rulerSeek(e);
              }}
              onPointerMove={(e) => scrubRef.current && rulerSeek(e)}
              onPointerUp={() => (scrubRef.current = false)}
            >
              {ticks.map((tick) => (
                <div key={tick.time} className="absolute top-0 h-full" style={{ left: tick.time * pps }}>
                  <div className={`w-px ${tick.major ? "h-full bg-white/20" : "h-2 bg-white/10 mt-auto absolute bottom-0"}`} />
                  {tick.major && tick.label && (
                    <span className="absolute left-1 top-0.5 font-mono text-[8px] text-neutral-500">{tick.label}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Track rows (each preceded by its collapsible layer slot) ── */}
          {displayTracks.map((track) => {
            const slotOpen = activeSlotTrackId === track.id;
            return (
              <React.Fragment key={track.id}>
                {/* Layer slot — the "space that opens up" above the track */}
                <div
                  ref={(el) => {
                    if (el) slotRefs.current.set(track.id, el);
                    else slotRefs.current.delete(track.id);
                  }}
                  style={{ height: slotOpen ? SLOT_H : 0 }}
                  className="flex overflow-hidden transition-[height] duration-150 ease-out"
                >
                  <div
                    className="sticky left-0 z-20 flex shrink-0 items-center justify-center border-r border-white/5 bg-[#0a0f1d]"
                    style={{ width: HEADER_W }}
                  >
                    <span className="text-[8px] font-bold font-mono uppercase tracking-widest text-blue-400">
                      New layer
                    </span>
                  </div>
                  <div className="relative flex-1 bg-blue-500/5">
                    <div className="absolute inset-x-1 inset-y-1 rounded-md border border-dashed border-blue-500/40" />
                    {slotOpen && (
                      <div
                        className="absolute top-1 bottom-1 rounded-md border border-blue-400 bg-blue-500/25 shadow-[0_0_14px_rgba(59,130,246,0.5)]"
                        style={{ left: activeSlotStart * pps, width: Math.max(activeSlotWidth, 12) }}
                      />
                    )}
                  </div>
                </div>

                {/* Track row */}
                <div className="flex border-b border-white/[0.04]" style={{ height: ROW_H }}>
                  {/* Header */}
                  <div
                    className="sticky left-0 z-20 flex shrink-0 items-center justify-between gap-1 border-r border-white/5 bg-[#0a0f1d] px-2"
                    style={{ width: HEADER_W }}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {track.kind === "video" ? (
                        <Clapperboard size={11} className="text-blue-400 shrink-0" />
                      ) : (
                        <Music size={11} className="text-emerald-400 shrink-0" />
                      )}
                      <span className="truncate text-[9px] font-bold font-mono uppercase tracking-wider text-neutral-400">
                        {track.name}
                      </span>
                    </div>
                    <div className="flex items-center shrink-0">
                      <button
                        title={track.muted ? "Unmute track" : "Mute track"}
                        onClick={() => engine.setTrackProps(track.id, { muted: !track.muted })}
                        className={`p-1 rounded ${track.muted ? "text-red-400" : "text-neutral-600 hover:text-white"}`}
                      >
                        {track.muted ? <VolumeX size={10} /> : <Volume2 size={10} />}
                      </button>
                      <button
                        title={track.locked ? "Unlock track" : "Lock track"}
                        onClick={() => engine.setTrackProps(track.id, { locked: !track.locked })}
                        className={`p-1 rounded ${track.locked ? "text-yellow-400" : "text-neutral-600 hover:text-white"}`}
                      >
                        {track.locked ? <Lock size={10} /> : <Unlock size={10} />}
                      </button>
                    </div>
                  </div>

                  {/* Lane */}
                  <div
                    ref={(el) => {
                      if (el) laneRefs.current.set(track.id, el);
                      else laneRefs.current.delete(track.id);
                    }}
                    className={`relative flex-1 transition-colors ${track.muted ? "opacity-40" : ""}`}
                    onPointerDown={() => onSelect(null)}
                  >
                    {/* Free-space landing highlight */}
                    {laneHighlightId === track.id && (
                      <div
                        className="pointer-events-none absolute top-1 bottom-1 z-20 rounded-md border border-blue-400/80 bg-blue-500/15"
                        style={{ left: laneHighlightStart * pps, width: Math.max(laneHighlightWidth, 12) }}
                      />
                    )}

                    {track.clips.map((clip) => {
                      const asset = doc.assets[clip.assetId];
                      const selected = clip.id === selectedClipId;
                      const isAudio = track.kind === "audio";
                      const isImage = asset?.kind === "image";
                      const lifted = ghost?.clipId === clip.id;
                      return (
                        <div
                          key={clip.id}
                          onPointerDown={(e) => onClipPointerDown(e, track, clip)}
                          onPointerMove={(e) => onClipPointerMove(e, track, clip)}
                          onPointerUp={(e) => onClipPointerUp(e, clip)}
                          className={`absolute top-1 bottom-1 overflow-hidden rounded-md border transition-shadow ${
                            tool === "razor" ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"
                          } ${lifted ? "opacity-30" : ""} ${
                            selected
                              ? "border-blue-400 ring-1 ring-blue-400/60 shadow-[0_0_14px_rgba(59,130,246,0.35)] z-10"
                              : "border-white/10 hover:border-white/25"
                          } ${
                            isAudio
                              ? "bg-emerald-950/80"
                              : isImage
                                ? "bg-purple-950/70"
                                : "bg-[#0e1a3a]"
                          }`}
                          style={{ left: clip.start * pps, width: Math.max(clip.duration * pps, 6) }}
                        >
                          {/* Video thumbnail backdrop */}
                          {!isAudio && asset?.kind === "video" && clip.duration * pps > 40 && (
                            <video
                              src={asset.url}
                              muted
                              playsInline
                              preload="metadata"
                              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40"
                            />
                          )}
                          {/* Image backdrop */}
                          {isImage && (
                            <img
                              src={asset.url}
                              alt=""
                              className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40"
                            />
                          )}
                          {/* Audio waveform texture */}
                          {isAudio && (
                            <div
                              className="pointer-events-none absolute inset-x-0 bottom-1 top-4 opacity-30"
                              style={{
                                background:
                                  "repeating-linear-gradient(90deg, rgba(16,185,129,0.9) 0 2px, transparent 2px 5px)",
                              }}
                            />
                          )}
                          {/* Label */}
                          <span className="pointer-events-none absolute left-2 top-1 z-10 flex max-w-[85%] items-center gap-1 truncate text-[8px] font-bold font-mono uppercase tracking-wider text-white/90 drop-shadow">
                            {isImage && <ImageIcon size={8} className="shrink-0" />}
                            {clip.label || asset?.label || (isAudio ? "Audio" : isImage ? "Image" : "Clip")}
                            {clip.speed !== 1 && <span className="text-blue-300">{clip.speed}x</span>}
                            {clip.muted && <span className="text-red-300">M</span>}
                          </span>
                          {/* Trim handles */}
                          <div className="absolute inset-y-0 left-0 z-10 w-[7px] cursor-ew-resize bg-white/20 opacity-0 hover:opacity-100" />
                          <div className="absolute inset-y-0 right-0 z-10 w-[7px] cursor-ew-resize bg-white/20 opacity-0 hover:opacity-100" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </React.Fragment>
            );
          })}

          {/* Empty-state hint */}
          {doc.tracks.every((t) => t.clips.length === 0) && (
            <div className="pointer-events-none absolute inset-x-0 top-1/2 z-10 flex justify-center" style={{ paddingLeft: HEADER_W }}>
              <span className="rounded-full border border-dashed border-white/10 bg-[#0a0f1d]/80 px-4 py-1.5 text-[10px] font-mono uppercase tracking-widest text-neutral-500">
                Drag clips, images, or audio from the media bin
              </span>
            </div>
          )}

          {/* ── Ghost clip riding the pointer ── */}
          {ghost && (
            <div
              className={`pointer-events-none absolute z-40 flex items-center overflow-hidden rounded-md border px-2 shadow-2xl ${
                ghost.target
                  ? ghost.trackKind === "audio"
                    ? "border-emerald-400/80 bg-emerald-900/80"
                    : "border-blue-400/80 bg-[#12224a]/90"
                  : "border-red-500/60 bg-red-950/60"
              }`}
              style={{
                left: HEADER_W + ghost.x,
                top: ghost.y - (ROW_H - 8) / 2,
                width: Math.max(ghost.duration * pps, 24),
                height: ROW_H - 8,
              }}
            >
              <span className="truncate text-[8px] font-bold font-mono uppercase tracking-wider text-white/90">
                {ghost.label}
              </span>
            </div>
          )}

          {/* ── Playhead ── */}
          <div
            className="pointer-events-none absolute top-0 bottom-0 z-30"
            style={{ left: HEADER_W + playhead * pps }}
          >
            <div className="absolute -left-[5px] top-[14px] h-0 w-0 border-x-[5px] border-t-[7px] border-x-transparent border-t-blue-400" />
            <div className="h-full w-px bg-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.8)]" />
          </div>
        </div>
      </div>
    </div>
  );
}
