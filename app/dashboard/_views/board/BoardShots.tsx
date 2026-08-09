"use client";

// BoardShots — /dashboard/project/[id]/board. The film's world, as pictures.
//
// Everything the shot board photographed, drawn as the hierarchy it actually is
// rather than as a flat gallery, because the hierarchy is the whole mechanism:
//
//   PLACE  →  ARRANGEMENT  →  OBJECT  →  SCENE FRAMES
//
// Every tier is generated FROM the picture of the tier above it, never from a
// re-reading of the words — that is what stops the room drifting between clips.
// So an arrow here is not decoration: it is the literal statement "this picture
// was built out of that one". A node with no arrow into it was built from prose,
// and if two scenes disagree about a room, this screen is where you can see why.
//
// Tap any still to open it full size.

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Edit3, Tv, X } from "lucide-react";
import OptiqMark from "../../../../components/OptiqMark";
import { useEditorFlow } from "../../_flow/EditorFlowProvider";
import { sceneStills, shotBoardStatusLabel } from "../../_flow/shotBoard";
import { ShotBoardPlate, ShotBoardState } from "../../_flow/types";
import { aspectStyle } from "../../_shared/aspect";

/** One picture the graph can open. */
interface Still {
  url: string;
  title: string;
  caption?: string;
}

/** One box on the canvas. */
interface Node {
  id: string;
  tier: "place" | "arrangement" | "object" | "scene";
  title: string;
  subtitle?: string;
  /** The chain of stills, oldest state first. Empty = planned but not shot. */
  stills: Still[];
  /** Square for objects, the film's shape for anything that is a frame. */
  square?: boolean;
  /**
   * 0-based scene index, for scene nodes only. What a per-node Retry re-shoots:
   * the board's scope takes scene indexes, and a node that cannot name one has
   * nothing to ask for.
   */
  sceneIndex?: number;
}

const TIERS: { key: Node["tier"]; label: string; blurb: string }[] = [
  { key: "place", label: "Places", blurb: "The room itself, empty. Everything below is built out of these." },
  { key: "arrangement", label: "Arrangements", blurb: "The place, dressed — what sits where, and who goes where." },
  { key: "object", label: "Objects", blurb: "The things that must not change, and every state they pass through." },
  { key: "scene", label: "Scene frames", blurb: "The stills each clip is actually rendered from." },
];

export default function BoardShots() {
  const router = useRouter();
  const {
    storyboard,
    shotBoard,
    shotBoardStage,
    shotBoardBusy,
    shotBoardProgress,
    shotBoardError,
    buildShotBoard,
    continueToFilm,
    setProductionMode,
    activeProjectId,
    aspectRatio,
  } = useEditorFlow();

  const [lightbox, setLightbox] = useState<Still | null>(null);
  const status = shotBoardStatusLabel(shotBoardStage, shotBoardProgress);

  // ── The graph ─────────────────────────────────────────────────────────────
  const { nodes, edges } = useMemo(() => {
    const world = shotBoard?.world;
    const plates = shotBoard?.plates || [];
    const nodes: Node[] = [];
    const edges: { from: string; to: string }[] = [];

    // A thing's pictures, in the order its states happen. A plate carries the
    // state it is of, so the order comes from the thing, not from the plates.
    const stillsFor = (
      tiers: ShotBoardPlate["tier"][],
      key: string,
      states: ShotBoardState[] | undefined,
      label: string
    ): Still[] => {
      const mine = plates.filter((p) => tiers.includes(p.tier) && p.key === key && p.url);
      const order = new Map((states || []).map((s, i) => [s.key, i]));
      return mine
        .sort((a, b) => (order.get(a.stateKey) ?? 0) - (order.get(b.stateKey) ?? 0))
        .map((p) => ({
          url: p.url as string,
          title: p.stateName && p.stateName !== p.name ? `${p.name} — ${p.stateName}` : p.name || label,
          caption: p.geometry || p.layout || p.detail || undefined,
        }));
    };

    for (const env of world?.environments || []) {
      nodes.push({
        id: `place:${env.key}`,
        tier: "place",
        title: env.name,
        subtitle: env.geometry,
        // The reverse angle is the same place from the other side, so it belongs
        // in the same node rather than pretending to be a second location.
        stills: stillsFor(["environment", "environment-reverse"], env.key, env.states, env.name),
      });
    }

    for (const setting of world?.settings || []) {
      const id = `arrangement:${setting.key}`;
      nodes.push({
        id,
        tier: "arrangement",
        title: setting.name,
        subtitle: setting.seating || setting.layout,
        stills: stillsFor(["setting"], setting.key, setting.states, setting.name),
      });
      if (setting.environmentKey) edges.push({ from: `place:${setting.environmentKey}`, to: id });
    }

    for (const object of world?.objects || []) {
      const id = `object:${object.key}`;
      nodes.push({
        id,
        tier: "object",
        title: object.name,
        subtitle: object.detail || object.kind,
        stills: stillsFor(["object"], object.key, object.states, object.name),
        square: true,
      });
      // An object hangs off every arrangement that holds it. One that belongs to
      // no arrangement simply floats — which is itself worth seeing.
      for (const setting of world?.settings || []) {
        if ((setting.objectKeys || []).includes(object.key)) {
          edges.push({ from: `arrangement:${setting.key}`, to: id });
        }
      }
    }

    // Scenes come last: one node per scene holding its whole filmstrip, rather
    // than one per still — ninety loose frames is a wall, not a graph.
    const sceneWorld = new Map((world?.sceneWorld || []).map((s) => [Number(s.sceneNumber), s]));
    (storyboard?.scenes || []).forEach((scene, idx) => {
      const stills = sceneStills(shotBoard, idx);
      const setups = shotBoard?.scenes?.[idx] ?? shotBoard?.scenes?.[String(idx)];
      if (stills.length === 0 && !setups) return;
      const id = `scene:${idx}`;
      const number = Number(scene.sceneNumber ?? idx + 1);
      nodes.push({
        id,
        tier: "scene",
        title: `Scene ${number}`,
        subtitle: setups?.coverage,
        stills: stills.map((s) => ({ url: s.url, title: `Scene ${number} — ${s.name}` })),
        sceneIndex: idx,
      });

      const w = sceneWorld.get(number);
      const parents = (w?.settingKeys || []).map((k) => `arrangement:${k}`);
      if (parents.length === 0 && w?.environmentKey) parents.push(`place:${w.environmentKey}`);
      for (const from of parents) edges.push({ from, to: id });
    });

    return { nodes, edges };
  }, [shotBoard, storyboard]);

  const byTier = (tier: Node["tier"]) => nodes.filter((n) => n.tier === tier);
  const photographed = nodes.reduce((n, node) => n + node.stills.length, 0);

  // Which scenes still have no frames. Computed from the STORYBOARD rather than
  // from the nodes, because a scene the board has not reached yet contributes no
  // node at all — counting nodes would report a one-scene board as complete.
  const sceneCount = storyboard?.scenes?.length ?? 0;
  const unphotographed = useMemo(() => {
    const out: number[] = [];
    for (let i = 0; i < sceneCount; i++) {
      if (sceneStills(shotBoard, i).length === 0) out.push(i);
    }
    return out;
  }, [sceneCount, shotBoard]);

  // ── Arrows ────────────────────────────────────────────────────────────────
  // Measured from the laid-out DOM rather than computed from a layout engine:
  // the nodes wrap freely at every width, so the only honest source of where a
  // box ended up is where the browser put it.
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const nodeRefs = useRef(new Map<string, HTMLElement>());
  const [paths, setPaths] = useState<string[]>([]);
  const [canvas, setCanvas] = useState({ w: 0, h: 0 });

  const registerNode = useCallback(
    (id: string) => (el: HTMLElement | null) => {
      if (el) nodeRefs.current.set(id, el);
      else nodeRefs.current.delete(id);
    },
    []
  );

  useLayoutEffect(() => {
    const measure = () => {
      const box = canvasRef.current;
      if (!box) return;
      const base = box.getBoundingClientRect();
      const next: string[] = [];
      for (const edge of edges) {
        const a = nodeRefs.current.get(edge.from);
        const b = nodeRefs.current.get(edge.to);
        if (!a || !b) continue;
        const ra = a.getBoundingClientRect();
        const rb = b.getBoundingClientRect();
        const x1 = ra.left - base.left + ra.width / 2;
        const y1 = ra.bottom - base.top;
        const x2 = rb.left - base.left + rb.width / 2;
        const y2 = rb.top - base.top;
        const bend = Math.max(18, (y2 - y1) / 2);
        next.push(`M${x1},${y1} C${x1},${y1 + bend} ${x2},${y2 - bend} ${x2},${y2}`);
      }
      setPaths((prev) => (prev.length === next.length && prev.every((p, i) => p === next[i]) ? prev : next));
      setCanvas((prev) =>
        prev.w === box.scrollWidth && prev.h === box.scrollHeight
          ? prev
          : { w: box.scrollWidth, h: box.scrollHeight }
      );
    };

    measure();
    // Images arrive after layout, and each one changes where everything below it
    // sits — so the arrows are re-measured as the pictures land, not just once.
    const observer = new ResizeObserver(measure);
    if (canvasRef.current) observer.observe(canvasRef.current);
    window.addEventListener("resize", measure);
    const settle = setTimeout(measure, 400);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
      clearTimeout(settle);
    };
  }, [edges, nodes]);

  // Escape closes the expanded still — a lightbox with only a mouse target is a
  // trap on a keyboard.
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  const goToScript = () => {
    setProductionMode("manual");
    router.push(`/dashboard/project/${activeProjectId}`);
  };
  const goToTimeline = () => {
    setProductionMode("auto-merge");
    router.push(`/dashboard/project/${activeProjectId}`);
  };

  /** Gate 2. Release the render pass, then follow it to the workspace. */
  const shootTheFilm = async () => {
    await continueToFilm();
    router.push(`/dashboard/project/${activeProjectId}`);
  };

  const thumb = (still: Still, square: boolean | undefined, key: string) => (
    <button
      key={key}
      onClick={() => setLightbox(still)}
      title={still.title}
      style={square ? { aspectRatio: "1" } : aspectStyle(aspectRatio)}
      className="w-20 shrink-0 overflow-hidden rounded-xl border border-line bg-background transition-colors hover:border-accent-line sm:w-24"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={still.url} alt={still.title} className="h-full w-full object-cover" loading="lazy" />
    </button>
  );

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      {/* ── TOP BAR ─────────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2.5 sm:px-4">
        <OptiqMark size={18} />
        <h1 className="min-w-0 flex-1 truncate border-l border-surface-2 pl-2 text-xs font-bold text-foreground sm:pl-3">
          {storyboard?.title || "Board shots"}
        </h1>

        <span className="hidden shrink-0 tabular-nums text-[10px] text-faint xl:inline">
          {photographed} still{photographed === 1 ? "" : "s"}
        </span>

        <div className="flex shrink-0 items-center gap-1 border-l border-surface-2 pl-1.5 sm:pl-2.5">
          <button
            onClick={() => router.push(`/dashboard/project/${activeProjectId}/agent`)}
            title="Optiq Agent"
            aria-label="Optiq Agent"
            className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-2 py-1.5 text-[11px] font-semibold text-ink-3 transition-colors hover:bg-surface-2 hover:text-accent-ink active:scale-95 sm:px-2.5"
          >
            <OptiqMark size={12} /> <span className="hidden sm:inline">Agent</span>
          </button>
          <button
            onClick={goToScript}
            title="Script editor"
            aria-label="Script editor"
            className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-2 py-1.5 text-[11px] font-semibold text-ink-3 transition-colors hover:bg-surface-2 hover:text-accent-ink active:scale-95 sm:px-2.5"
          >
            <Edit3 size={12} /> <span className="hidden sm:inline">Script</span>
          </button>
          <button
            onClick={goToTimeline}
            title="Timeline editor"
            aria-label="Timeline editor"
            className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-2 py-1.5 text-[11px] font-semibold text-ink-3 transition-colors hover:bg-surface-2 hover:text-accent-ink active:scale-95 sm:px-2.5"
          >
            <Tv size={12} /> <span className="hidden sm:inline">Timeline</span>
          </button>
        </div>
      </div>

      {/* ── STATUS, AND GATE 2 ──────────────────────────────────────────────
          The board is the second and last approval. Every scene has to have
          frames before the film can be shot, because on this film type a scene
          with no frames attaches nothing at all — its long prompt was
          deliberately written NOT to describe how anything looks, so rendering it
          anyway buys ten seconds of a different film. So the shoot button is
          disabled until the count is complete, and it says which scenes are
          holding it up rather than just refusing. */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2 sm:px-4">
        <p className="min-w-0 text-[11px] text-ink-3">
          {shotBoardError || status}
          {!shotBoardBusy && unphotographed.length > 0 && sceneCount > 0 && (
            <span className="ml-1.5 text-muted">
              · scene{unphotographed.length === 1 ? "" : "s"}{" "}
              {unphotographed.slice(0, 6).map((i) => i + 1).join(", ")}
              {unphotographed.length > 6 ? "…" : ""} still need photographing
            </span>
          )}
          {!shotBoardBusy && unphotographed.length === 0 && nodes.length > 0 && (
            <span className="ml-1.5 text-muted">· every picture below was built from the one above it</span>
          )}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => void buildShotBoard()}
            disabled={shotBoardBusy}
            className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-[11px] font-bold text-ink-3 transition-all hover:border-line-2 disabled:opacity-40"
          >
            <Camera size={11} />
            {photographed === 0 ? "Photograph the film" : "Photograph the rest"}
          </button>
          <button
            onClick={() => void shootTheFilm()}
            disabled={shotBoardBusy || sceneCount === 0 || unphotographed.length > 0}
            title={
              unphotographed.length > 0
                ? `${unphotographed.length} scene(s) have no frames yet — photograph them first.`
                : "Render every scene from its frames"
            }
            className="flex items-center gap-1.5 rounded-xl bg-foreground px-3 py-1.5 text-[11px] font-bold text-background transition-all hover:bg-ink-2 disabled:opacity-40"
          >
            <Tv size={11} /> Shoot the film
          </button>
        </div>
      </div>

      {/* ── CANVAS ──────────────────────────────────────────────────────────── */}
      <div className="min-h-0 flex-1 overflow-auto px-3 py-4 sm:px-6">
        {nodes.length === 0 ? (
          <p className="mx-auto max-w-sm pt-16 text-center text-[11px] leading-relaxed text-muted">
            Nothing photographed yet. The board builds itself behind every new
            film — places first, then how they are dressed, then the objects,
            then every camera setup.
          </p>
        ) : (
          <div ref={canvasRef} className="relative mx-auto max-w-6xl">
            {/* Under the nodes, so a curve never sits on top of a picture. */}
            <svg
              width={canvas.w}
              height={canvas.h}
              className="pointer-events-none absolute left-0 top-0"
              aria-hidden
            >
              <defs>
                <marker id="board-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
                  <path d="M0,0 L8,4 L0,8 z" className="fill-line-2" />
                </marker>
              </defs>
              {paths.map((d, i) => (
                <path
                  key={i}
                  d={d}
                  fill="none"
                  className="stroke-line-2"
                  strokeWidth={1.5}
                  markerEnd="url(#board-arrow)"
                />
              ))}
            </svg>

            <div className="relative space-y-8">
              {TIERS.map(({ key, label, blurb }) => {
                const tierNodes = byTier(key);
                if (tierNodes.length === 0) return null;
                return (
                  <section key={key}>
                    <div className="mb-2.5">
                      <span className="text-[9px] font-bold uppercase tracking-wide text-muted">{label}</span>
                      <p className="text-[10px] text-faint">{blurb}</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {tierNodes.map((node) => (
                        <div
                          key={node.id}
                          ref={registerNode(node.id)}
                          className="w-full max-w-[420px] rounded-[22px] border border-line bg-surface p-3 sm:w-auto"
                        >
                          <p className="truncate text-[11px] font-bold text-foreground">{node.title}</p>
                          {node.subtitle && (
                            <p className="mt-0.5 line-clamp-2 max-w-[320px] text-[10px] leading-relaxed text-muted">
                              {node.subtitle}
                            </p>
                          )}
                          <div className="mt-2 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
                            {node.stills.length === 0 ? (
                              <span className="flex h-14 items-center rounded-xl border border-dashed border-line-2 px-3 text-[10px] text-muted">
                                {shotBoardBusy ? "being photographed" : "not photographed"}
                              </span>
                            ) : (
                              node.stills.map((still, i) => (
                                <React.Fragment key={`${node.id}-${i}`}>
                                  {/* States are a chain — this arrow says the
                                      next picture was made from the last one. */}
                                  {i > 0 && <span className="shrink-0 text-[10px] text-faint">→</span>}
                                  {thumb(still, node.square, `${node.id}-${i}`)}
                                </React.Fragment>
                              ))
                            )}
                          </div>

                          {/* Per-scene re-shoots. A scene the board could not
                              photograph has NOTHING to attach to its render on
                              this film type, so it must be retried rather than
                              rendered through — and a scene whose frames are
                              simply wrong is worth re-cutting before thirty
                              seconds of video is bought from them.

                              Two different asks: RETRY keeps the setups and
                              re-takes the pictures; RE-CUT throws the coverage
                              away and lets the designer decide the angles again. */}
                          {node.sceneIndex !== undefined && !shotBoardBusy && (
                            <div className="mt-2 flex items-center gap-3">
                              <button
                                onClick={() => void buildShotBoard([node.sceneIndex!], true)}
                                className="text-[10px] font-semibold text-muted transition-colors hover:text-accent-ink"
                              >
                                {node.stills.length === 0 ? "Photograph this scene" : "Retry these frames"}
                              </button>
                              {node.stills.length > 0 && (
                                <button
                                  onClick={() => void buildShotBoard([node.sceneIndex!], false)}
                                  className="text-[10px] font-semibold text-muted transition-colors hover:text-accent-ink"
                                >
                                  Re-cut the angles
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── EXPANDED STILL ──────────────────────────────────────────────────── */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm"
          onClick={() => setLightbox(null)}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-foreground">{lightbox.title}</p>
              {lightbox.caption && (
                <p className="mt-0.5 line-clamp-2 max-w-2xl text-[11px] leading-relaxed text-muted">
                  {lightbox.caption}
                </p>
              )}
            </div>
            <button
              onClick={() => setLightbox(null)}
              title="Close"
              aria-label="Close"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink-2 transition-colors hover:text-foreground active:scale-95"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.url}
              alt={lightbox.title}
              onClick={(e) => e.stopPropagation()}
              className="max-h-full max-w-full rounded-2xl border border-line object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
