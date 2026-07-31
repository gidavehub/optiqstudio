"use client";

// ProjectWorkspace — /dashboard/project/[id]. Two switchable faces:
//   "auto-merge" → CapCut-style EditorStudio (rendering HUD while scenes cook)
//   "manual"     → script / prompt-engineering deck
// The two-way switch lives in both faces (hard product requirement).
//
// The script face itself has two layouts: a two-column deck on desktop, and a
// one-scene-per-page flip deck on phones (MobileScriptDeck) — a phone can't
// usefully scroll nine scenes' worth of 2,000-word prompts.

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCw, Edit3, AlertCircle, Undo2, Tv, Play, Bot,
} from "lucide-react";
import { useEditorFlow } from "../_flow/EditorFlowProvider";
import { useAuth } from "../../../components/AuthProvider";
import ConfirmGenerationModal from "../../../components/ConfirmGenerationModal";
import useIsMobile from "../_shared/useIsMobile";
import EditorStudio from "./editor/EditorStudio";
import DirectionPanel from "./script/DirectionPanel";
import MobileScriptDeck from "./script/MobileScriptDeck";
import SceneBeats from "./script/SceneBeats";
import ScenePromptBlock from "./script/ScenePromptBlock";
import SceneReferenceImages from "./script/SceneReferenceImages";
import SceneRenderPanel, { SceneRenderStatus } from "./script/SceneRenderPanel";

/** Every storyboard scene renders as a 10-second clip. */
const SCENE_SECONDS = 10;

export default function ProjectWorkspace() {
  const {
    storyboard, setStoryboard, videoStatus, setVideoStatus,
    productionMode, setProductionMode,
    generating, error, setError, retryStoryboard, projectsLoading,
    pipelineStage, pipelineProgress,
    copyToClipboard, copiedIndex,
    generateVideoForScene, reviseScenePrompt,
    sceneImages, projectMaterials,
    addSceneImages, attachMaterialToScene, removeSceneImage,
    goHome, projects, activeProjectId, agentRunning,
  } = useEditorFlow();
  const { profile, pricing } = useAuth();
  const isMobile = useIsMobile();
  const router = useRouter();

  const openAgent = () => router.push(`/dashboard/project/${activeProjectId}/agent`);

  const project = projects.find((p) => p.id === activeProjectId) ?? null;

  // ── Render pricing ─────────────────────────────────────────────────────
  // Paying for the ad buys its scene renders up front, so the project carries a
  // `prepaidRenders` allowance. While that lasts a render is free; once it's
  // spent (i.e. any RE-render) the clip is charged like a Direct Studio one, and
  // the user gets the same price-confirmation modal they get everywhere else.
  const perSecond = pricing?.costs.videoPerSecond?.omni ?? 15;
  const clipPrice = perSecond * SCENE_SECONDS;
  const prepaidLeft = Number(project?.prepaidRenders) || 0;
  const renderCost = (sceneIndex: number) => {
    const status = videoStatus[sceneIndex]?.status;
    // A scene that has never produced a clip draws on the allowance first.
    const firstAttempt = status !== "succeeded";
    return firstAttempt && prepaidLeft > 0 ? 0 : clipPrice;
  };

  const [pendingRender, setPendingRender] = useState<{ index: number; prompt: string; cost: number } | null>(null);
  // Lets the user into the timeline with a partial set of clips when one or
  // more scenes failed and retrying isn't what they want right now.
  const [forceEditor, setForceEditor] = useState(false);

  const requestRender = (sceneIndex: number, prompt: string) => {
    const cost = renderCost(sceneIndex);
    if (cost <= 0) {
      // Already paid for as part of the ad — no need to ask again.
      void generateVideoForScene(sceneIndex, prompt);
      return;
    }
    setPendingRender({ index: sceneIndex, prompt, cost });
  };

  // Live label for the cloud storyboard job's current stage.
  const STAGE_LABELS: Record<string, string> = {
    queued: "Queued — starting the swarm…",
    analyzing: "Analyzing your brief…",
    storylining: "Writing your storyline…",
    casting: "Casting characters & locking consistency…",
    building: "Building your scenes…",
  };
  const isCloudGenerating =
    generating || ["queued", "analyzing", "storylining", "casting", "building"].includes(pipelineStage || "");
  const stageLabel = STAGE_LABELS[pipelineStage || ""] || "Optiq Skills are writing your story…";

  const resetDraft = () => {
    if (confirm("Are you sure you want to reset this draft? Unsaved changes will be lost.")) {
      goHome();
    }
  };

  const sceneCount = storyboard?.scenes.length ?? 0;
  const renderTally = useMemo(() => {
    let done = 0;
    let failed = 0;
    for (let i = 0; i < sceneCount; i++) {
      const s = videoStatus[i]?.status;
      if (s === "succeeded") done++;
      else if (s === "failed") failed++;
    }
    return { done, failed, pending: sceneCount - done - failed };
  }, [sceneCount, videoStatus]);

  const confirmModal = (
    <ConfirmGenerationModal
      isOpen={!!pendingRender}
      onClose={() => setPendingRender(null)}
      onConfirm={() => {
        if (pendingRender) void generateVideoForScene(pendingRender.index, pendingRender.prompt);
        setPendingRender(null);
      }}
      cost={pendingRender?.cost ?? 0}
      balance={profile?.credits ?? 0}
      title="Confirm Scene Render"
      description={`Scene ${(pendingRender?.index ?? 0) + 1} — ${SCENE_SECONDS}s clip`}
      actionLabel="Render Scene"
    />
  );

  // The way into the storyline agent, carried by every face of the workspace.
  // Pulses while a turn is running server-side, so a rewrite kicked off from
  // the chat is visible even from the timeline.
  const agentButton = (
    <button
      onClick={openAgent}
      title="Work on the whole storyline with the agent"
      className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors active:scale-95 ${
        agentRunning
          ? "animate-pulse border-blue-400 bg-[#131d35] text-blue-300"
          : "border-white/5 bg-white/5 text-neutral-300 hover:bg-white/10 hover:text-blue-400"
      }`}
    >
      <Bot size={13} />
      <span className="hidden sm:inline">{agentRunning ? "Agent working…" : "Agent"}</span>
    </button>
  );

  // ── EMPTY / GENERATING / ERROR STATES ──────────────────────────────────
  if (!storyboard) {
    return (
      <div className="flex h-full flex-col bg-background text-neutral-200">
        <div className="mx-auto flex h-full max-w-lg flex-1 flex-col items-center justify-center p-12 text-center">
          {isCloudGenerating ? (
            <div className="space-y-6">
              <div className="relative mx-auto h-44 w-72 overflow-hidden rounded-3xl border border-white/10 bg-black shadow-[0_24px_80px_rgba(0,0,0,0.7)] sm:h-52 sm:w-96">
                <div className="aurora" aria-hidden />
                <div className="aurora-veil" aria-hidden />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-center text-sm font-bold tracking-tight text-white">{stageLabel}</h3>
                {pipelineStage === "building" && pipelineProgress ? (
                  <p className="text-center font-mono text-[11px] text-neutral-500">
                    Scene {pipelineProgress.scenesDone} / {pipelineProgress.scenesTotal}
                  </p>
                ) : (
                  <p className="mx-auto max-w-xs text-center text-[11px] text-neutral-500">
                    Running in the cloud — you can safely close this tab and come back; it&apos;ll pick up right here.
                  </p>
                )}
              </div>
            </div>
          ) : error ? (
            <div className="mx-auto max-w-md space-y-5 rounded-2xl border border-red-500/15 bg-red-950/20 p-8">
              <AlertCircle size={36} className="mx-auto animate-pulse text-red-400" />
              <h3 className="text-center font-mono text-sm font-bold uppercase tracking-wider text-white">
                Generation Encountered an Issue
              </h3>
              <p className="text-center text-xs leading-relaxed text-red-400/90">
                {error || "Vertex AI rate limits or an internal timeout. Retrying is free — you were only charged once."}
              </p>
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => {
                    setError(null);
                    void retryStoryboard();
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-black transition-all hover:bg-neutral-200"
                >
                  <RefreshCw size={12} /> Retry Storyboard Generation
                </button>
              </div>
            </div>
          ) : projectsLoading ? (
            <div className="space-y-4">
              <RefreshCw size={32} className="mx-auto animate-spin text-neutral-500" />
              <h3 className="text-center font-mono text-sm font-bold uppercase text-neutral-300">Loading Project…</h3>
            </div>
          ) : (
            <div className="space-y-4">
              <AlertCircle size={32} className="mx-auto text-neutral-500" />
              <h3 className="text-center font-mono text-sm font-bold uppercase text-neutral-300">Project Empty</h3>
              <p className="mx-auto max-w-sm text-center text-xs text-neutral-500">
                No storyboard specification has been initialized for this project.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── AUTO-MERGE FACE ────────────────────────────────────────────────────
  if (productionMode === "auto-merge") {
    // Every scene rendered → the timeline editor takes the whole viewport. This
    // is the landing point of "make the whole film": script → clips → timeline,
    // with no stop in the script editor on the way.
    if (forceEditor || (renderTally.done === sceneCount && sceneCount > 0)) {
      return <EditorStudio project={{ ...(project ?? {}), id: activeProjectId, title: storyboard.title, videoStatus }} />;
    }

    const percent = Math.round((renderTally.done / Math.max(sceneCount, 1)) * 100);
    // A failed scene never becomes "succeeded", so without this the HUD would
    // spin forever with no way forward. Once nothing is still in flight, offer
    // both a retry and a way into the timeline with what did render.
    const stalled = renderTally.pending === 0 && renderTally.failed > 0;

    return (
      <div className="flex h-full flex-col bg-background text-neutral-200">
        {/* Minimal chrome, top corners only */}
        <div className="absolute left-0 right-0 top-16 z-10 flex items-center justify-between gap-2 px-4 py-4 sm:px-6">
          <h2 className="max-w-[40%] truncate text-sm font-bold tracking-tight text-white/90">{storyboard.title}</h2>
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <span className="font-mono text-[11px] font-bold text-neutral-400">
              {renderTally.done}
              <span className="text-neutral-600"> / {sceneCount}</span>
            </span>
            {agentButton}
            <button
              onClick={() => setProductionMode("manual")}
              className="flex items-center gap-1.5 rounded-xl border border-white/5 bg-white/5 px-3.5 py-2 text-xs font-semibold transition-colors hover:bg-white/10 hover:text-blue-400"
            >
              <Edit3 size={12} /> Script Editor
            </button>
            <button
              onClick={resetDraft}
              className="flex items-center gap-1.5 rounded-xl border border-white/5 bg-white/5 px-3.5 py-2 text-xs font-semibold transition-colors hover:bg-white/10"
            >
              <Undo2 size={12} /> Reset
            </button>
          </div>
        </div>

        {/* Clips — top-aligned + scrollable so the very first scene is always
            reachable. On mobile: ≤3 scenes stack one-up; 4+ show two per row. */}
        <div className="flex-1 overflow-y-auto px-4 pb-24 pt-28 sm:px-6">
          <div
            className={`mx-auto grid w-full gap-3 sm:gap-6 ${
              sceneCount <= 3 ? "max-w-5xl grid-cols-1 sm:grid-cols-3" : "max-w-6xl grid-cols-2 md:grid-cols-3"
            }`}
          >
            {storyboard.scenes.map((scene, idx) => {
              const stat = videoStatus[idx];
              const ready = stat?.status === "succeeded" && stat.url;
              const failed = stat?.status === "failed";
              return (
                <div
                  key={idx}
                  className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_16px_48px_rgba(0,0,0,0.7)]"
                >
                  {ready ? (
                    <>
                      <video src={stat.url} autoPlay loop muted playsInline preload="auto" className="h-full w-full object-cover" />
                      <span className="absolute bottom-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-black shadow-lg">
                        <Play size={10} fill="black" className="translate-x-[1px]" />
                      </span>
                    </>
                  ) : failed ? (
                    <button
                      onClick={() => requestRender(idx, stat?.customPrompt || scene.fullPrompt)}
                      className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-red-950/30 p-3 text-center transition-colors hover:bg-red-950/50"
                    >
                      <AlertCircle size={20} className="text-red-400" />
                      <span className="text-[10px] font-bold text-white">Scene {scene.sceneNumber} failed</span>
                      <span className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-neutral-200">
                        <RefreshCw size={10} /> Retry
                      </span>
                    </button>
                  ) : (
                    <>
                      <div className="aurora" aria-hidden />
                      <div className="aurora-veil" aria-hidden />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="font-display text-4xl text-white/90 drop-shadow-lg sm:text-5xl">
                          {scene.sceneNumber}
                        </span>
                      </div>
                    </>
                  )}
                  <span className="absolute left-2 top-2 rounded-full bg-black/50 px-2 py-0.5 font-mono text-[9px] font-bold text-white/80 backdrop-blur">
                    Scene {scene.sceneNumber}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-2.5 px-4">
          <p className="text-center font-mono text-[11px] text-neutral-500">
            {stalled
              ? `${renderTally.failed} scene${renderTally.failed === 1 ? "" : "s"} didn't render — retry above, or continue with what's ready`
              : `Crafting your scenes — ${percent}%`}
          </p>
          {stalled && renderTally.done > 0 && (
            <button
              onClick={() => setForceEditor(true)}
              className="flex items-center gap-1.5 rounded-xl bg-white px-5 py-2.5 text-xs font-bold text-black transition-all hover:bg-neutral-200"
            >
              <Tv size={13} /> Open timeline anyway
            </button>
          )}
        </div>

        {confirmModal}
      </div>
    );
  }

  // ── SCRIPT FACE — MOBILE (page-by-page deck) ───────────────────────────
  if (isMobile) {
    return (
      <>
        <MobileScriptDeck
          storyboard={storyboard}
          setStoryboard={setStoryboard}
          videoStatus={videoStatus}
          setVideoStatus={setVideoStatus}
          sceneImages={sceneImages}
          projectMaterials={projectMaterials}
          addSceneImages={addSceneImages}
          attachMaterialToScene={attachMaterialToScene}
          removeSceneImage={removeSceneImage}
          reviseScenePrompt={reviseScenePrompt}
          copyToClipboard={copyToClipboard}
          copiedIndex={copiedIndex}
          renderCost={renderCost}
          onRequestRender={requestRender}
          onOpenTimeline={() => setProductionMode("auto-merge")}
          onOpenAgent={openAgent}
          agentRunning={agentRunning}
        />
        {confirmModal}
      </>
    );
  }

  // ── SCRIPT FACE — DESKTOP ──────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col bg-background text-neutral-200">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col overflow-y-auto px-4 pb-6 pt-20 sm:px-6 sm:pt-24">
        {/* Header controls */}
        <div className="flex flex-col gap-4 border-b border-white/5 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="rounded-full border border-blue-500/30 bg-[#0c152d] px-2.5 py-0.5 text-[10px] font-bold uppercase text-blue-400">
              Script Engineering
            </span>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-white md:text-2xl">{storyboard.title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-neutral-500">{storyboard.concept}</p>
          </div>
          <div className="flex items-center gap-2 self-start">
            <span className="rounded-xl border border-white/5 bg-white/5 px-3 py-2 font-mono text-[11px] font-bold text-neutral-400">
              {renderTally.done}
              <span className="text-neutral-600"> / {sceneCount}</span> rendered
            </span>
            {agentButton}
            <button
              onClick={() => setProductionMode("auto-merge")}
              className="flex items-center gap-1.5 rounded-xl border border-blue-500/40 bg-[#0c152d] px-4 py-2 text-xs font-semibold text-blue-400 transition-colors hover:border-blue-400 hover:bg-[#131d35]"
            >
              <Tv size={12} /> Open Timeline Editor
            </button>
            <button
              onClick={resetDraft}
              className="flex items-center gap-1.5 rounded-xl border border-white/5 bg-white/5 px-4 py-2 text-xs font-semibold transition-colors hover:bg-white/10"
            >
              <Undo2 size={12} /> Reset Draft
            </button>
          </div>
        </div>

        {/* Film-wide locks */}
        <div className="mt-6">
          <DirectionPanel storyboard={storyboard} setStoryboard={setStoryboard} />
        </div>

        {/* Scene cards */}
        <div className="mt-10 flex items-center gap-3 border-b border-white/5 pb-3">
          <span className="flex h-6 w-6 items-center justify-center rounded border border-blue-500/30 bg-[#0c152d] text-blue-400">
            <Tv size={12} />
          </span>
          <h3 className="text-base font-bold tracking-tight text-white">Scene Generation Panel</h3>
        </div>

        <div className="mt-5 flex flex-col gap-6">
          {storyboard.scenes.map((scene, idx) => {
            const status = videoStatus[idx] || { status: "idle" as const, revisionInput: "" };
            const patchStatus = (patch: Record<string, unknown>) =>
              setVideoStatus((prev) => ({ ...prev, [idx]: { ...prev[idx], ...patch } }));

            return (
              <div
                key={scene.sceneNumber}
                className="grid grid-cols-1 items-start gap-5 rounded-3xl border border-white/5 bg-[#0a1124] p-4 transition-colors hover:border-blue-500/30 sm:gap-6 sm:p-5 lg:grid-cols-12 lg:p-6"
              >
                {/* Scene copy */}
                <div className="space-y-4 lg:col-span-7">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-[#131d35] px-2.5 py-0.5 text-[10px] font-bold text-white">
                      Scene {scene.sceneNumber} — {SCENE_SECONDS}s clip
                    </span>
                  </div>

                  <SceneBeats
                    scene={scene}
                    revisionInput={status.revisionInput || ""}
                    revising={!!status.revising}
                    onRevisionInput={(v) => patchStatus({ revisionInput: v })}
                    onRevise={() => void reviseScenePrompt(idx)}
                  />

                  <ScenePromptBlock
                    value={status.customPrompt || scene.fullPrompt}
                    editing={!!status.editingPrompt}
                    onChange={(v) => patchStatus({ customPrompt: v })}
                    onToggleEdit={() =>
                      patchStatus({
                        editingPrompt: !status.editingPrompt,
                        customPrompt: status.customPrompt || scene.fullPrompt,
                      })
                    }
                    onCopy={() => copyToClipboard(status.customPrompt || scene.fullPrompt, idx)}
                    copied={copiedIndex === idx}
                  />

                  <SceneReferenceImages
                    sceneIndex={idx}
                    attached={sceneImages[idx] || []}
                    available={projectMaterials.filter(
                      (mat) =>
                        mat.mimeType.startsWith("image/") &&
                        !(sceneImages[idx] || []).some((img) => img.path === mat.path)
                    )}
                    onUpload={(files) => void addSceneImages(idx, files)}
                    onAttach={(mat) => attachMaterialToScene(idx, mat)}
                    onRemove={(imgIdx) => removeSceneImage(idx, imgIdx)}
                  />
                </div>

                {/* Render column */}
                <div className="flex h-full flex-col justify-center lg:col-span-5">
                  <SceneRenderPanel
                    status={(status.status || "idle") as SceneRenderStatus}
                    url={status.url}
                    error={status.error}
                    cost={renderCost(idx)}
                    onRender={() => requestRender(idx, status.customPrompt || scene.fullPrompt)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {confirmModal}
    </div>
  );
}
