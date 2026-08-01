"use client";

// MobileScriptDeck — the script editor on a phone.
//
// The desktop deck stacks every scene into one endless scroll. On a phone that
// is unusable: each scene carries a video, four beat cards, a 500–2,000 word
// prompt and a rewrite box, so nine scenes became a kilometre of column.
//
// So the phone gets one card per page, exactly like the creation wizard: chrome
// and progress dots at the top, Back/Next at the bottom, and a 3D flip between
// pages. Page 1 is the film-wide direction (locks, style, music); pages 2..n+1
// are the scenes, video first.

import React, { useEffect, useRef, useState } from "react";
import { Bot, ChevronLeft, ChevronRight, Sliders, Tv } from "lucide-react";
import {
  Scene, SceneImage, Storyboard, VideoStatusMap, activeTakeIndex, sceneTakes,
} from "../../_flow/types";
import DirectionPanel from "./DirectionPanel";
import SceneBeats from "./SceneBeats";
import ScenePromptBlock from "./ScenePromptBlock";
import SceneReferenceImages from "./SceneReferenceImages";
import SceneRenderPanel, { SceneRenderStatus } from "./SceneRenderPanel";

interface MobileScriptDeckProps {
  storyboard: Storyboard;
  setStoryboard: React.Dispatch<React.SetStateAction<Storyboard | null>>;
  videoStatus: VideoStatusMap;
  setVideoStatus: React.Dispatch<React.SetStateAction<VideoStatusMap>>;
  sceneImages: Record<number, SceneImage[]>;
  projectMaterials: SceneImage[];
  addSceneImages: (sceneIndex: number, files: FileList | File[]) => Promise<void>;
  attachMaterialToScene: (sceneIndex: number, material: SceneImage) => void;
  removeSceneImage: (sceneIndex: number, imageIndex: number) => void;
  reviseScenePrompt: (sceneIndex: number) => Promise<void>;
  copyToClipboard: (text: string, index: number) => void;
  copiedIndex: number | null;
  /** GMD a render of the given scene will cost right now (0 when prepaid). */
  renderCost: (sceneIndex: number) => number;
  onRequestRender: (sceneIndex: number, prompt: string) => void;
  /** Puts an earlier take of a scene back on air. */
  onSelectTake: (sceneIndex: number, takeIndex: number) => void;
  onOpenTimeline: () => void;
  /** Opens the storyline agent — the deck's film-wide page. */
  onOpenAgent: () => void;
  /** True while an agent turn is rewriting this film server-side. */
  agentRunning: boolean;
}

export default function MobileScriptDeck({
  storyboard,
  setStoryboard,
  videoStatus,
  setVideoStatus,
  sceneImages,
  projectMaterials,
  addSceneImages,
  attachMaterialToScene,
  removeSceneImage,
  reviseScenePrompt,
  copyToClipboard,
  copiedIndex,
  renderCost,
  onRequestRender,
  onSelectTake,
  onOpenTimeline,
  onOpenAgent,
  agentRunning,
}: MobileScriptDeckProps) {
  // Page 0 is Direction; scene i lives on page i + 1.
  const pageCount = storyboard.scenes.length + 1;
  const [page, setPage] = useState(0);
  const [direction, setDirection] = useState<"next" | "prev">("next");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Every page starts at the top — carrying the previous page's scroll offset
  // over makes the flip feel broken.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [page]);

  const go = (to: number) => {
    if (to < 0 || to >= pageCount || to === page) return;
    setDirection(to > page ? "next" : "prev");
    setPage(to);
  };

  const sceneIndex = page - 1;
  const scene: Scene | undefined = storyboard.scenes[sceneIndex];
  const status = scene ? videoStatus[sceneIndex] || { status: "idle" as const } : undefined;

  const patchStatus = (idx: number, patch: Record<string, unknown>) =>
    setVideoStatus((prev) => ({ ...prev, [idx]: { ...prev[idx], ...patch } }));

  return (
    <div className="flex h-full flex-col bg-background text-foreground">
      {/* ── TOP CHROME: where you are, and how far through ── */}
      <header className="relative z-10 shrink-0 px-4 pb-2 pt-16">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="block font-mono text-[9px] font-bold uppercase tracking-widest text-accent-ink">
              {page === 0 ? "Direction" : `Scene ${scene?.sceneNumber ?? sceneIndex + 1} · 10s`}
            </span>
            <h2 className="truncate text-sm font-bold tracking-tight text-foreground">{storyboard.title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              onClick={onOpenAgent}
              aria-label="Storyline agent"
              className={`flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-[11px] font-bold transition-colors active:scale-95 ${
                agentRunning
                  ? "animate-pulse border-accent bg-surface-2 text-accent-ink"
                  : "border-line bg-surface text-ink-2"
              }`}
            >
              <Bot size={12} />
            </button>
            <button
              onClick={onOpenTimeline}
              className="flex items-center gap-1.5 rounded-2xl border border-accent-line bg-surface px-3 py-2 text-[11px] font-bold text-accent-ink transition-colors active:scale-95"
            >
              <Tv size={12} /> Timeline
            </button>
          </div>
        </div>

        {/* Progress dots — tap one to jump straight there */}
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {Array.from({ length: pageCount }, (_, i) => {
            const done = i > 0 && videoStatus[i - 1]?.status === "succeeded";
            return (
              <button
                key={i}
                onClick={() => go(i)}
                aria-label={i === 0 ? "Direction" : `Scene ${i}`}
                className={`h-1.5 shrink-0 rounded-full transition-all duration-300 ${
                  i === page
                    ? "w-8 bg-foreground"
                    : done
                      ? "w-4 bg-emerald-500/70"
                      : i < page
                        ? "w-4 bg-blue-500/70"
                        : "w-4 bg-surface-2"
                }`}
              />
            );
          })}
        </div>
      </header>

      {/* ── THE PAGE ── */}
      <main ref={scrollRef} className="relative z-10 min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <div
          key={page}
          className={direction === "next" ? "animate-deck-next" : "animate-deck-prev"}
        >
          {page === 0 ? (
            <div className="space-y-4 pt-1">
              <div className="rounded-[28px] border border-line bg-surface p-4">
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-3">
                  <Sliders size={11} className="text-accent-ink" /> Film-wide direction
                </span>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                  {storyboard.concept}
                </p>
              </div>

              {/* The whole-storyline page. The fields below edit one lock at a
                  time; this is where you change the film itself. */}
              <button
                onClick={onOpenAgent}
                className="flex w-full items-center gap-3 rounded-3xl border border-accent-line bg-surface p-4 text-left transition-colors active:scale-[0.99]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-accent-line bg-surface-2 text-accent-ink">
                  <Bot size={16} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-bold tracking-tight text-foreground">
                    {agentRunning ? "Agent is working…" : "Work the whole storyline"}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-3">
                    Talk it through — rewrite scenes, retune the arc, keep every lock intact.
                  </span>
                </span>
                <ChevronRight size={15} className="shrink-0 text-accent-ink" />
              </button>

              <DirectionPanel storyboard={storyboard} setStoryboard={setStoryboard} stacked />
            </div>
          ) : scene && status ? (
            <div className="space-y-4 pt-1">
              {/* The clip leads — it's the thing you came to look at. */}
              <SceneRenderPanel
                status={(status.status || "idle") as SceneRenderStatus}
                url={status.url}
                error={status.error}
                cost={renderCost(sceneIndex)}
                onRender={() => onRequestRender(sceneIndex, status.customPrompt || scene.fullPrompt)}
                takes={sceneTakes(status)}
                activeTake={activeTakeIndex(status)}
                onSelectTake={(take) => onSelectTake(sceneIndex, take)}
                compact
              />

              <SceneBeats
                scene={scene}
                revisionInput={status.revisionInput || ""}
                revising={!!status.revising}
                onRevisionInput={(v) => patchStatus(sceneIndex, { revisionInput: v })}
                onRevise={() => void reviseScenePrompt(sceneIndex)}
                stacked
              />

              <ScenePromptBlock
                value={status.customPrompt || scene.fullPrompt}
                editing={!!status.editingPrompt}
                onChange={(v) => patchStatus(sceneIndex, { customPrompt: v })}
                onToggleEdit={() =>
                  patchStatus(sceneIndex, {
                    editingPrompt: !status.editingPrompt,
                    customPrompt: status.customPrompt || scene.fullPrompt,
                  })
                }
                onCopy={() => copyToClipboard(status.customPrompt || scene.fullPrompt, sceneIndex)}
                copied={copiedIndex === sceneIndex}
                collapsedClass="max-h-32"
              />

              <SceneReferenceImages
                sceneIndex={sceneIndex}
                attached={sceneImages[sceneIndex] || []}
                available={projectMaterials.filter(
                  (mat) =>
                    mat.mimeType.startsWith("image/") &&
                    !(sceneImages[sceneIndex] || []).some((img) => img.path === mat.path)
                )}
                onUpload={(files) => void addSceneImages(sceneIndex, files)}
                onAttach={(mat) => attachMaterialToScene(sceneIndex, mat)}
                onRemove={(imgIdx) => removeSceneImage(sceneIndex, imgIdx)}
              />
            </div>
          ) : null}
        </div>
      </main>

      {/* ── BOTTOM NAV: exactly the wizard's, so the flow feels the same ── */}
      <footer className="relative z-10 flex shrink-0 justify-center px-4 pb-4 pt-2">
        <div className="flex w-full max-w-xl items-center justify-between gap-4 rounded-3xl border border-line bg-surface/85 px-4 py-3 shadow-2xl shadow-black/95 backdrop-blur-xl">
          <button
            onClick={() => go(page - 1)}
            disabled={page === 0}
            className="flex items-center gap-1.5 rounded-2xl border border-line bg-surface px-4 py-2.5 text-xs font-semibold text-ink-2 transition-colors active:scale-95 disabled:opacity-30"
          >
            <ChevronLeft size={13} /> Back
          </button>

          <span className="font-mono text-[10px] uppercase tracking-widest text-muted">
            {page === 0 ? "Direction" : `${page} / ${storyboard.scenes.length}`}
          </span>

          {page < pageCount - 1 ? (
            <button
              onClick={() => go(page + 1)}
              className="flex items-center gap-1.5 rounded-2xl bg-foreground px-5 py-2.5 text-xs font-bold text-background shadow-lg transition-all active:scale-95 hover:bg-ink-2"
            >
              Next <ChevronRight size={13} />
            </button>
          ) : (
            <button
              onClick={onOpenTimeline}
              className="flex items-center gap-1.5 rounded-2xl bg-accent px-5 py-2.5 text-xs font-bold text-white shadow-lg transition-all active:scale-95 hover:bg-accent"
            >
              <Tv size={13} /> Timeline
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
