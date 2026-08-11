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
  RefreshCw, AlertCircle, Tv, Play,
} from "lucide-react";
import { useEditorFlow } from "../_flow/EditorFlowProvider";
import { activeTakeIndex, sceneTakes } from "../_flow/types";
import { renderPrompt } from "../_flow/shotBoard";
import { useAuth } from "../../../components/AuthProvider";
import ConfirmGenerationModal from "../../../components/ConfirmGenerationModal";
import useIsMobile from "../_shared/useIsMobile";
import { audioStageLabel } from "../_shared/audioStages";
import BlueprintStage from "./blueprint/BlueprintStage";
import EditorStudio from "./editor/EditorStudio";
import MobileScriptDeck from "./script/MobileScriptDeck";
import SceneDialogue from "./script/SceneDialogue";
import ScenePromptBlock from "./script/ScenePromptBlock";
import SceneReferenceImages from "./script/SceneReferenceImages";
import SceneRewriteBar from "./script/SceneRewriteBar";
import SceneRenderPanel, { SceneRenderStatus } from "./script/SceneRenderPanel";
import WorkspaceModeBar from "./script/WorkspaceModeBar";
import { gridBox, previewBox } from "../_shared/aspect";

/** Every storyboard scene renders as a 10-second clip. */
const SCENE_SECONDS = 10;

export default function ProjectWorkspace() {
  const {
    storyboard, videoStatus, setVideoStatus,
    productionMode, setProductionMode,
    generating, error, setError, retryStoryboard, projectsLoading,
    pipelineStage, pipelineProgress,
    copyToClipboard, copiedIndex,
    generateVideoForScene, selectSceneTake, reviseScenePrompt,
    sceneImages, projectMaterials,
    addSceneImages, attachMaterialToScene, removeSceneImage,
    goHome, projects, activeProjectId, agentRunning, audioStage,
    // The ad's shape. Every preview box below is cut to it, so a vertical ad
    // previews vertical instead of sitting letterboxed in a 16:9 frame.
    aspectRatio,
    isGatedFilm,
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
    locations: "Writing the location bible — every place, once, in full…",
  };
  const isCloudGenerating =
    generating ||
    ["queued", "analyzing", "storylining", "casting", "locations", "building"].includes(pipelineStage || "");
  const stageLabel = STAGE_LABELS[pipelineStage || ""] || "Optiq Skills are writing your story…";

  const resetDraft = () => {
    if (confirm("Are you sure you want to reset this draft? Unsaved changes will be lost.")) {
      goHome();
    }
  };

  // Scene clips sit in a grid, so they use the grid rule: landscape fills the
  // column, portrait is height-capped and centred. The generating screen is a
  // single hero, so it gets the more generous preview cap.
  const sceneBox = gridBox(aspectRatio);
  const heroBox = previewBox(aspectRatio);

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

  // The way into the storyline agent now lives in WorkspaceModeBar alongside
  // the other two faces, so this face-local button is gone.

  // ── THE GATE — THE BLUEPRINT (experimental original story only) ─────────
  //
  // This film type does not open into the script editor. It stops on a screen
  // built for READING a five-minute film before paying to render it, and it
  // stays there until the director presses Continue — which moves the stage to
  // "ready", after which the workspace behaves normally.
  //
  // Checked before the !storyboard branch below on purpose: "blueprint-ready" is
  // a terminal stage with scenes attached, so falling through would show the
  // ordinary script editor and quietly skip the gate.
  if (isGatedFilm && storyboard && pipelineStage === "blueprint-ready") {
    return <BlueprintStage />;
  }

  // ── EMPTY / GENERATING / ERROR STATES ──────────────────────────────────
  if (!storyboard) {
    return (
      <div className="flex h-full flex-col bg-background text-foreground">
        <div className="mx-auto flex h-full max-w-lg flex-1 flex-col items-center justify-center p-12 text-center">
          {isCloudGenerating ? (
            <div className="space-y-6">
              {/* Was a fixed landscape rectangle whatever you were making. It
                  is the shape of the ad now, so a vertical film says so while
                  it is still being written — and portrait is bounded by height
                  so it stays a comparable size to the landscape version. */}
              <div
                style={heroBox.style}
                className={`relative mx-auto overflow-hidden rounded-[28px] border border-line bg-background shadow-[0_24px_60px_rgba(16,24,40,0.12)] ${
                  heroBox.className === "w-full" ? "w-72 sm:w-96" : heroBox.className
                }`}
              >
                <div className="aurora" aria-hidden />
                <div className="aurora-veil" aria-hidden />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-center text-sm font-bold tracking-tight text-foreground">{stageLabel}</h3>
                {pipelineStage === "building" && pipelineProgress ? (
                  <p className="text-center tabular-nums text-[11px] text-muted">
                    Scene {pipelineProgress.scenesDone} / {pipelineProgress.scenesTotal}
                  </p>
                ) : (
                  <p className="mx-auto max-w-xs text-center text-[11px] text-muted">
                    Running in the cloud — you can safely close this tab and come back; it&apos;ll pick up right here.
                  </p>
                )}
              </div>
            </div>
          ) : error ? (
            <div className="mx-auto max-w-md space-y-5 rounded-3xl border border-danger bg-danger-soft p-8">
              <AlertCircle size={36} className="mx-auto animate-pulse text-danger" />
              <h3 className="text-center tabular-nums text-sm font-bold uppercase tracking-wider text-foreground">
                Generation Encountered an Issue
              </h3>
              <p className="text-center text-xs leading-relaxed text-danger">
                {error || "Vertex AI rate limits or an internal timeout. Retrying is free — you were only charged once."}
              </p>
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => {
                    setError(null);
                    void retryStoryboard();
                  }}
                  className="flex items-center gap-1.5 rounded-2xl bg-foreground px-5 py-2.5 text-xs font-bold text-background transition-all hover:bg-ink-2"
                >
                  <RefreshCw size={12} /> Retry Storyboard Generation
                </button>
              </div>
            </div>
          ) : projectsLoading ? (
            <div className="space-y-4">
              <RefreshCw size={32} className="mx-auto animate-spin text-muted" />
              <h3 className="text-center tabular-nums text-sm font-bold uppercase text-ink-2">Loading Project…</h3>
            </div>
          ) : (
            <div className="space-y-4">
              <AlertCircle size={32} className="mx-auto text-muted" />
              <h3 className="text-center tabular-nums text-sm font-bold uppercase text-ink-2">Project Empty</h3>
              <p className="mx-auto max-w-sm text-center text-xs text-muted">
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
    // A finished film means picture AND sound. The timeline used to open the
    // moment the last clip landed, which dropped the director into a silent cut
    // while the score and the voiceover were still being made — and a narrated
    // ad at that moment is completely mute, so it reads as a film that came out
    // broken rather than one that isn't finished yet. Both halves, then the door.
    const picture = renderTally.done === sceneCount && sceneCount > 0;
    const sound = audioStage === "ready" || audioStage === "failed";
    if (forceEditor || (picture && sound)) {
      // aspectRatio is passed explicitly rather than relying on the spread: the
      // editor builds its canvas from it, and the flow's value is the one the
      // rest of this screen is already cut to (it falls back to 16:9), so the
      // timeline can't disagree with the previews the director just looked at.
      return (
        <EditorStudio
          project={{
            ...(project ?? {}),
            id: activeProjectId,
            title: storyboard.title,
            videoStatus,
            aspectRatio,
          }}
        />
      );
    }

    const percent = Math.round((renderTally.done / Math.max(sceneCount, 1)) * 100);
    // A failed scene never becomes "succeeded", so without this the HUD would
    // spin forever with no way forward. Once nothing is still in flight, offer
    // both a retry and a way into the timeline with what did render.
    const stalled = renderTally.pending === 0 && renderTally.failed > 0;

    return (
      <div className="flex h-full flex-col bg-background text-foreground">
        {/* Where you are, and the way to the other two faces — centred at the
            top, in the gap between the logo and account pills. */}
        <WorkspaceModeBar
          current="auto-merge"
          onAgent={openAgent}
          onScript={() => setProductionMode("manual")}
          onTimeline={() => setProductionMode("auto-merge")}
          onReset={resetDraft}
          agentRunning={agentRunning}
          done={renderTally.done}
          total={sceneCount}
        />

        {/* The film's title sits under the bar rather than beside it, so a long
            one no longer competes with the controls for the same row. */}
        <div className="absolute left-0 right-0 top-16 z-10 flex items-center justify-center px-4 py-4 sm:px-6">
          <h2 className="max-w-full truncate text-sm font-bold tracking-tight text-foreground">{storyboard.title}</h2>
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
                  style={sceneBox.style}
                  className={`relative overflow-hidden rounded-3xl border border-line bg-background shadow-[0_16px_40px_rgba(16,24,40,0.10)] ${sceneBox.className}`}
                >
                  {ready ? (
                    <>
                      <video src={stat.url} autoPlay loop muted playsInline preload="auto" className="h-full w-full object-cover" />
                      <span className="absolute bottom-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-success text-background shadow-lg">
                        <Play size={10} fill="currentColor" className="translate-x-[1px]" />
                      </span>
                    </>
                  ) : failed ? (
                    <button
                      onClick={() => requestRender(idx, renderPrompt(scene, stat?.customPrompt))}
                      className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-danger-soft p-3 text-center transition-colors hover:bg-danger-soft"
                    >
                      <AlertCircle size={20} className="text-danger" />
                      <span className="text-[10px] font-bold text-foreground">Scene {scene.sceneNumber} failed</span>
                      <span className="flex items-center gap-1 rounded-xl border border-line bg-surface px-2.5 py-1 text-[10px] font-semibold text-foreground">
                        <RefreshCw size={10} /> Retry
                      </span>
                    </button>
                  ) : (
                    <>
                      <div className="aurora" aria-hidden />
                      <div className="aurora-veil" aria-hidden />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="font-display text-4xl text-foreground drop-shadow-lg sm:text-5xl">
                          {scene.sceneNumber}
                        </span>
                      </div>
                    </>
                  )}
                  <span className="absolute left-2 top-2 rounded-full bg-background/80 px-2 py-0.5 tabular-nums text-[9px] font-bold text-ink-2 backdrop-blur">
                    Scene {scene.sceneNumber}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-2.5 px-4">
          <p className="text-center tabular-nums text-[11px] text-muted">
            {stalled
              ? `${renderTally.failed} scene${renderTally.failed === 1 ? "" : "s"} didn't render — retry above, or continue with what's ready`
              : picture
                ? audioStageLabel(audioStage)
                : `Crafting your scenes — ${percent}%`}
          </p>

          {/* The second half of the wait, and the one nobody was told about: the
              clips are all in and the film is being scored and narrated. */}
          {picture && !stalled && (
            <p className="mx-auto max-w-xs text-center text-[11px] leading-relaxed text-ink-3">
              Every scene is in. The score and the voiceover are written against
              the finished cut, so they come last — the timeline opens with the
              film complete.
            </p>
          )}

          {stalled && renderTally.done > 0 && (
            <button
              onClick={() => setForceEditor(true)}
              className="flex items-center gap-1.5 rounded-2xl bg-foreground px-5 py-2.5 text-xs font-bold text-background transition-all hover:bg-ink-2"
            >
              <Tv size={13} /> Open timeline anyway
            </button>
          )}

          {/* Never a locked door. Waiting is the default and the better outcome,
              but an audio pass that dies quietly must not strand the director in
              front of a film they can already watch. Shown for the whole wait
              rather than appearing on a timer: a control that materialises after
              a delay reads as the page malfunctioning. */}
          {picture && !stalled && (
            <button
              onClick={() => setForceEditor(true)}
              className="text-[11px] font-semibold text-ink-3 underline underline-offset-4 transition-colors hover:text-foreground"
            >
              Open the timeline without waiting
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
          aspect={aspectRatio}
          storyboard={storyboard}
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
          onSelectTake={selectSceneTake}
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
    <div className="flex h-full flex-col bg-background text-foreground">
      {/* Same bar as the timeline face — one control cluster, one position, and
          the current face is filled in so it is obvious where you are. */}
      <WorkspaceModeBar
        current="manual"
        onAgent={openAgent}
        onScript={() => setProductionMode("manual")}
        onTimeline={() => setProductionMode("auto-merge")}
        onReset={resetDraft}
        agentRunning={agentRunning}
        done={renderTally.done}
        total={sceneCount}
      />

      {/* pt-28 clears the floating bar, which the old inline button row did not
          have to account for. */}
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col overflow-y-auto px-4 pb-6 pt-28 sm:px-6 sm:pt-32">
        {/* The header is now only the film — the controls left for the bar. */}
        <div className="border-b border-line pb-5">
          <span className="rounded-full border border-accent-line bg-surface px-2.5 py-0.5 text-[10px] font-bold uppercase text-accent-ink">
            Script Engineering
          </span>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-foreground md:text-2xl">{storyboard.title}</h2>
          <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted">{storyboard.concept}</p>
        </div>

        {/* Scene cards. The film-wide locks (character, style, music) used to sit
            above this; they're machinery, not something a user came here to read,
            so the storyline blurb in the header is all the film-level context the
            page carries now. */}
        <div className="mt-8 flex items-center gap-3 border-b border-line pb-3">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg border border-accent-line bg-surface text-accent-ink">
            <Tv size={12} />
          </span>
          <h3 className="text-base font-bold tracking-tight text-foreground">Scene Generation Panel</h3>
        </div>

        <div className="mt-5 flex flex-col gap-6">
          {storyboard.scenes.map((scene, idx) => {
            const status = videoStatus[idx] || { status: "idle" as const, revisionInput: "" };
            const patchStatus = (patch: Record<string, unknown>) =>
              setVideoStatus((prev) => ({ ...prev, [idx]: { ...prev[idx], ...patch } }));

            return (
              <div
                key={scene.sceneNumber}
                className="grid grid-cols-1 items-start gap-5 rounded-[28px] border border-line bg-surface p-4 transition-colors hover:border-accent-line sm:gap-6 sm:p-5 lg:grid-cols-12 lg:p-6"
              >
                {/* Scene copy */}
                <div className="space-y-4 lg:col-span-7">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2.5 py-0.5 text-[10px] font-bold text-foreground">
                      Scene {scene.sceneNumber} — {SCENE_SECONDS}s clip
                    </span>
                  </div>

                  <SceneDialogue scene={scene} />

                  <ScenePromptBlock
                    value={renderPrompt(scene, status.customPrompt)}
                    editing={!!status.editingPrompt}
                    onChange={(v) => patchStatus({ customPrompt: v })}
                    onToggleEdit={() =>
                      patchStatus({
                        editingPrompt: !status.editingPrompt,
                        customPrompt: renderPrompt(scene, status.customPrompt),
                      })
                    }
                    onCopy={() => copyToClipboard(renderPrompt(scene, status.customPrompt), idx)}
                    copied={copiedIndex === idx}
                  />

                  {/* Sits between the prompt and the references: you read the
                      prompt, then say what to change about it. */}
                  <SceneRewriteBar
                    value={status.revisionInput || ""}
                    revising={!!status.revising}
                    onChange={(v) => patchStatus({ revisionInput: v })}
                    onRevise={() => void reviseScenePrompt(idx)}
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
                    onRender={() => requestRender(idx, renderPrompt(scene, status.customPrompt))}
                    takes={sceneTakes(videoStatus[idx])}
                    activeTake={activeTakeIndex(videoStatus[idx])}
                    onSelectTake={(take) => selectSceneTake(idx, take)}
                    aspect={aspectRatio}
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
