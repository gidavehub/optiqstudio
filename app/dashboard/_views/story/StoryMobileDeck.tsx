"use client";

// MobileScriptDeck — the script editor on a phone.
//
// The desktop deck stacks every scene into one endless scroll. On a phone that
// is unusable: each scene carries a video, a 500–2,000 word prompt and a rewrite
// box, so nine scenes became a kilometre of column.
//
// So the phone gets one card per page, exactly like the creation wizard: chrome
// and progress dots at the top, Back/Next at the bottom, and a 3D flip between
// pages. Page 1 is scene 1 — you land straight on work you can do. A storyline
// page used to sit in front of it, restating the concept and offering the agent;
// it was a doorstep, not a page, and the agent is one tap away in the chrome.

import React, { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Tv } from "lucide-react";
import OptiqMark from "../../../../components/OptiqMark";
import {
  Scene, ShotBoard, Storyboard, VideoStatusMap, activeTakeIndex, sceneTakes,
} from "../../_flow/types";
import { renderPrompt, sceneStills } from "../../_flow/shotBoard";
import StorySceneDialogue from "./StorySceneDialogue";
import StoryPromptBlock from "./StoryPromptBlock";
import SceneBoardShots from "./SceneBoardShots";
import StoryRenderPanel, { SceneRenderStatus } from "./StoryRenderPanel";
import StoryRewriteBar from "./StoryRewriteBar";

interface StoryMobileDeckProps {
  storyboard: Storyboard;
  videoStatus: VideoStatusMap;
  setVideoStatus: React.Dispatch<React.SetStateAction<VideoStatusMap>>;
  /** The film's photographs. A scene renders from these and nothing else. */
  shotBoard: ShotBoard | null;
  shotBoardBusy: boolean;
  onRetryBoard: (sceneIndex: number) => void;
  /** Drop a setup. Same affordances as the desktop strip — see SceneBoardShots. */
  onRemoveBoardShot?: (sceneIndex: number, order: number) => void;
  /** Ask for one more angle, in the director's own words. */
  onAddBoardShot?: (sceneIndex: number, note: string) => void;
  /** The director's own pictures, straight onto the board. */
  onAddBoardImages?: (sceneIndex: number, files: File[]) => void;
  reviseScenePrompt: (sceneIndex: number) => Promise<void>;
  copyToClipboard: (text: string, index: number) => void;
  copiedIndex: number | null;
  /** GMD a render of the given scene will cost right now (0 when prepaid). */
  renderCost: (sceneIndex: number) => number;
  onRequestRender: (sceneIndex: number, prompt: string) => void;
  /** Puts an earlier take of a scene back on air. */
  onSelectTake: (sceneIndex: number, takeIndex: number) => void;
  onOpenTimeline: () => void;
  /** Opens the storyline agent — the only way to work the film as a whole. */
  onOpenAgent: () => void;
  /** True while an agent turn is rewriting this film server-side. */
  agentRunning: boolean;
  /** The ad's shape, forwarded to every scene panel in the deck. */
  aspect?: string | null;
}

export default function StoryMobileDeck({
  aspect,
  storyboard,
  videoStatus,
  setVideoStatus,
  shotBoard,
  shotBoardBusy,
  onRetryBoard,
  onRemoveBoardShot,
  onAddBoardShot,
  onAddBoardImages,
  reviseScenePrompt,
  copyToClipboard,
  copiedIndex,
  renderCost,
  onRequestRender,
  onSelectTake,
  onOpenTimeline,
  onOpenAgent,
  agentRunning,
}: StoryMobileDeckProps) {
  // One page per scene, and nothing else — page i IS scene i.
  const pageCount = storyboard.scenes.length;
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

  const sceneIndex = page;
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
            <span className="block tabular-nums text-[9px] font-bold uppercase tracking-widest text-accent-ink">
              Scene {scene?.sceneNumber ?? sceneIndex + 1} · 10s
            </span>
            <h2 className="truncate text-sm font-bold tracking-tight text-foreground">{storyboard.title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {/* The agent's icon is the Optiq mark, not a generic robot — this is
                the product talking. With the storyline page gone this button is
                the only way to the film as a whole, so it carries its word. */}
            <button
              onClick={onOpenAgent}
              aria-label="Optiq Agent"
              className={`flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-[11px] font-bold transition-colors active:scale-95 ${
                agentRunning
                  ? "animate-pulse border-accent bg-surface-2 text-accent-ink"
                  : "border-line bg-surface text-ink-2"
              }`}
            >
              <OptiqMark size={13} /> Agent
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
            const done = videoStatus[i]?.status === "succeeded";
            return (
              <button
                key={i}
                onClick={() => go(i)}
                aria-label={`Scene ${i + 1}`}
                className={`h-1.5 shrink-0 rounded-full transition-all duration-300 ${
                  i === page
                    ? "w-8 bg-foreground"
                    : done
                      ? "w-4 bg-success"
                      : i < page
                        ? "w-4 bg-accent"
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
          {scene && status ? (
            <div className="space-y-4 pt-1">
              {/* The clip leads — it's the thing you came to look at. */}
              <StoryRenderPanel
                status={(status.status || "idle") as SceneRenderStatus}
                url={status.url}
                error={status.error}
                cost={renderCost(sceneIndex)}
                onRender={() => onRequestRender(sceneIndex, renderPrompt(scene, status.customPrompt))}
                takes={sceneTakes(status)}
                activeTake={activeTakeIndex(status)}
                onSelectTake={(take) => onSelectTake(sceneIndex, take)}
                aspect={aspect}
                compact
              />

              <StorySceneDialogue scene={scene} />

              <StoryPromptBlock
                value={renderPrompt(scene, status.customPrompt)}
                editing={!!status.editingPrompt}
                onChange={(v) => patchStatus(sceneIndex, { customPrompt: v })}
                onToggleEdit={() =>
                  patchStatus(sceneIndex, {
                    editingPrompt: !status.editingPrompt,
                    customPrompt: renderPrompt(scene, status.customPrompt),
                  })
                }
                onCopy={() => copyToClipboard(renderPrompt(scene, status.customPrompt), sceneIndex)}
                copied={copiedIndex === sceneIndex}
                collapsedClass="max-h-32"
              />

              <StoryRewriteBar
                value={status.revisionInput || ""}
                revising={!!status.revising}
                onChange={(v) => patchStatus(sceneIndex, { revisionInput: v })}
                onRevise={() => void reviseScenePrompt(sceneIndex)}
              />

              <SceneBoardShots
                sceneIndex={sceneIndex}
                stills={sceneStills(shotBoard, sceneIndex)}
                aspectRatio={aspect || "16:9"}
                busy={shotBoardBusy}
                onRetry={onRetryBoard}
                onRemove={onRemoveBoardShot}
                onAdd={onAddBoardShot}
                onAddImages={onAddBoardImages}
              />
            </div>
          ) : null}
        </div>
      </main>

      {/* ── BOTTOM NAV: exactly the wizard's, so the flow feels the same ── */}
      <footer className="relative z-10 flex shrink-0 justify-center px-4 pb-4 pt-2">
        <div className="flex w-full max-w-xl items-center justify-between gap-4 rounded-3xl border border-line bg-surface/85 px-4 py-3 elevate-lg shadow-black/10 backdrop-blur-xl">
          <button
            onClick={() => go(page - 1)}
            disabled={page === 0}
            className="flex items-center gap-1.5 rounded-2xl border border-line bg-surface px-4 py-2.5 text-xs font-semibold text-ink-2 transition-colors active:scale-95 disabled:opacity-30"
          >
            <ChevronLeft size={13} /> Back
          </button>

          <span className="tabular-nums text-[10px] uppercase tracking-widest text-muted">
            {page + 1} / {storyboard.scenes.length}
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
              className="flex items-center gap-1.5 rounded-2xl bg-accent px-5 py-2.5 text-xs font-bold text-white shadow-lg transition-all active:scale-95 hover:bg-accent-hover"
            >
              <Tv size={13} /> Timeline
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
