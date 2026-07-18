"use client";

// ProjectWorkspace — /dashboard/project/[id]. Two switchable faces:
//   "auto-merge" → CapCut-style EditorStudio (compiling HUD while scenes render)
//   "manual"     → script / prompt-engineering deck
// The two-way switch lives in both faces (hard product requirement).

import React from "react";
import {
  Clapperboard, Video, Play, RefreshCw, Edit3, Wand2, Check, CheckCircle,
  AlertCircle, Undo2, Tv, Copy,
} from "lucide-react";
import { useEditorFlow } from "../_flow/EditorFlowProvider";
import EditorStudio from "./editor/EditorStudio";

export default function ProjectWorkspace() {
  const {
    storyboard, setStoryboard, videoStatus, setVideoStatus,
    productionMode, setProductionMode,
    generating, error, setError, generateStoryboard, projectsLoading,
    copyToClipboard, copiedIndex,
    generateVideoForScene, reviseScenePrompt,
    goHome, projects, activeProjectId,
  } = useEditorFlow();

  const project = projects.find((p) => p.id === activeProjectId) ?? null;

  const resetDraft = () => {
    if (confirm("Are you sure you want to reset this draft? Unsaved changes will be lost.")) {
      goHome();
    }
  };

  // ── EMPTY / GENERATING / ERROR STATES ──────────────────────────────────
  if (!storyboard) {
    return (
      <div className="flex h-full flex-col bg-background text-neutral-200">
        <div className="flex flex-1 flex-col items-center justify-center p-12 text-center h-full max-w-lg mx-auto">
          {generating ? (
            <div className="space-y-4">
              <RefreshCw size={42} className="text-white animate-spin mx-auto" />
              <h3 className="text-lg font-bold text-white tracking-tight uppercase font-mono text-center">Compiling Storyboard Spec...</h3>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed text-center">
                Our Gemini AI director is composing your visual style matrix, structuring consecutive script moments, and generating custom-ready direct prompts. This takes about 10-15 seconds.
              </p>
            </div>
          ) : error ? (
            <div className="space-y-5 rounded-2xl border border-red-500/15 bg-red-950/20 p-8 max-w-md mx-auto">
              <AlertCircle size={36} className="text-red-400 mx-auto animate-pulse" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono text-center">Generation Encountered a Transient Issue</h3>
              <p className="text-xs text-red-400/90 leading-relaxed text-center">
                {error || "Vertex AI rate limits or internal operation timeout. Your credits have not been deducted."}
              </p>
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => {
                    setError(null);
                    void generateStoryboard();
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-white hover:bg-neutral-200 px-5.5 py-2.5 text-xs font-bold text-black transition-all"
                >
                  <RefreshCw size={12} /> Retry Storyboard Generation
                </button>
              </div>
            </div>
          ) : projectsLoading ? (
            <div className="space-y-4">
              <RefreshCw size={32} className="text-neutral-500 animate-spin mx-auto" />
              <h3 className="text-sm font-bold text-neutral-300 uppercase font-mono text-center">Loading Project...</h3>
            </div>
          ) : (
            <div className="space-y-4">
              <AlertCircle size={32} className="text-neutral-500 mx-auto" />
              <h3 className="text-sm font-bold text-neutral-300 uppercase font-mono text-center">Project Empty</h3>
              <p className="text-xs text-neutral-500 max-w-sm mx-auto text-center">
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
    const totalScenes = storyboard.scenes.length;
    const completedCount = storyboard.scenes.filter((_, idx) => videoStatus[idx]?.status === "succeeded").length;
    const isCompiling = completedCount < totalScenes;
    const compilePercent = Math.round((completedCount / Math.max(totalScenes, 1)) * 100);

    // Clips ready → the CapCut editor takes the full viewport.
    if (!isCompiling) {
      return <EditorStudio project={{ ...(project ?? {}), id: activeProjectId, title: storyboard.title, videoStatus }} />;
    }

    // Still rendering scene segments → cinematic compiling HUD.
    return (
      <div className="flex h-full flex-col bg-background text-neutral-200">
        <div className="flex flex-1 flex-col overflow-y-auto px-6 pb-6 pt-24 w-full max-w-4xl mx-auto space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/5 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-white bg-[#131d35] rounded px-2.5 py-0.5 uppercase border border-white/10">
                  Cinematic Theater Player
                </span>
                <span className="flex items-center gap-1 text-[9px] font-bold text-yellow-400 bg-yellow-500/10 rounded px-2 py-0.5 uppercase border border-yellow-500/15 animate-pulse">
                  Compiling Reels ({completedCount}/{totalScenes})
                </span>
              </div>
              <h2 className="mt-2 text-xl font-bold tracking-tight text-white md:text-2xl">{storyboard.title}</h2>
              <p className="mt-1 text-xs text-neutral-500 leading-relaxed max-w-xl">{storyboard.concept}</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setProductionMode("manual")}
                className="flex items-center gap-1.5 rounded-xl bg-white/5 border border-white/5 px-4 py-2 text-xs font-semibold hover:bg-white/10 hover:text-blue-400 transition-colors"
              >
                <Edit3 size={12} /> Switch to Script Editor
              </button>
              <button
                onClick={resetDraft}
                className="flex items-center gap-1.5 rounded-xl bg-white/5 border border-white/5 px-4 py-2 text-xs font-semibold hover:bg-white/10 transition-colors"
              >
                <Undo2 size={12} /> Reset Draft
              </button>
            </div>
          </div>

          {/* Compiling viewport */}
          <div className="w-full aspect-video shrink-0 relative rounded-2xl bg-black border border-white/5 overflow-hidden shadow-[0_12px_45px_rgba(0,0,0,0.95)]">
            <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center space-y-6 bg-[radial-gradient(circle_at_center,rgba(37,99,235,0.08)_0%,rgba(0,0,0,1)_100%)] bg-black">
              <div className="relative flex items-center justify-center h-20 w-20">
                <span className="absolute h-full w-full rounded-full border-2 border-white/10 animate-ping duration-1000" />
                <span className="absolute h-16 w-16 rounded-full border border-white/10 animate-spin border-t-white" />
                <Clapperboard className="text-white animate-pulse relative" size={26} />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-sm font-bold text-white uppercase tracking-widest font-mono flex items-center justify-center gap-2">
                  Rendering Scene Segments
                </h3>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
                  Gemini Omni is orchestrating cinematic camera movements, actors, and brand styles for your advertisement. The timeline editor unlocks the moment every reel lands.
                </p>
              </div>

              <div className="bg-[#0c152d]/60 backdrop-blur-md border border-white/5 rounded-2xl p-5 w-full max-w-sm space-y-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                <div className="flex justify-between text-[10px] font-mono text-neutral-400 uppercase tracking-widest font-bold">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 bg-neutral-500 rounded-full animate-ping" />
                    Synthesizing Reel
                  </span>
                  <span>{compilePercent}% ({completedCount}/{totalScenes} Clips)</span>
                </div>
                <div className="h-2 w-full bg-[#0e1630] rounded-full overflow-hidden border border-white/[0.02] p-[1px]">
                  <div
                    className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all duration-500 ease-out shadow-[0_0_12px_rgba(59,130,246,0.5)]"
                    style={{ width: `${compilePercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[9px] font-mono text-neutral-500 uppercase tracking-wider">
                  <span>Model: Gemini Omni Flash</span>
                  <span>Est. Time: ~30s</span>
                </div>
              </div>
            </div>
          </div>

          {/* Per-scene status grid */}
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {storyboard.scenes.map((scene, idx) => {
              const stat = videoStatus[idx];
              const isSceneRendering = stat?.status === "rendering";
              const isSceneReady = stat?.status === "succeeded";
              return (
                <div
                  key={idx}
                  className={`rounded-xl border p-4.5 text-left transition-all duration-300 flex flex-col justify-between relative overflow-hidden ${
                    isSceneRendering
                      ? "border-white/10 bg-[#0e1630]/50 shadow-[0_4px_24px_rgba(255,255,255,0.02)] animate-pulse"
                      : isSceneReady
                      ? "border-emerald-500/15 bg-emerald-950/[0.02] shadow-[0_4px_24px_rgba(16,185,129,0.03)]"
                      : "border-white/5 bg-surface/50"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-neutral-500 font-bold">SEGMENT #{idx + 1}</span>
                      {isSceneRendering ? (
                        <span className="text-[9px] font-bold text-white flex items-center gap-1 uppercase font-mono tracking-wider animate-pulse">
                          <RefreshCw size={8} className="animate-spin" /> Synthesizing...
                        </span>
                      ) : isSceneReady ? (
                        <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-1 uppercase font-mono tracking-wider">
                          <Check size={8} /> Ready
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold text-neutral-600 uppercase font-mono tracking-wider">Queued</span>
                      )}
                    </div>
                    <h4 className="mt-2 text-xs font-bold text-white line-clamp-1">{scene.setting}</h4>
                  </div>
                  <p className="mt-2.5 text-[10px] text-neutral-500 line-clamp-2 leading-relaxed font-sans">{scene.fullPrompt}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── SCRIPT / PROMPT-ENGINEERING FACE ──────────────────────────────────
  return (
    <div className="flex h-full flex-col bg-background text-neutral-200">
      <div className="flex flex-1 flex-col overflow-y-auto px-6 pb-6 pt-24 w-full max-w-6xl mx-auto">
        {/* Header Controls */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/5 pb-5">
          <div>
            <span className="text-[10px] font-bold text-blue-400 bg-[#0c152d] rounded px-2.5 py-0.5 uppercase border border-blue-500/30">
              Script Engineering
            </span>
            <h2 className="mt-2 text-xl font-bold tracking-tight text-white md:text-2xl">{storyboard.title}</h2>
            <p className="mt-1 text-xs text-neutral-500 leading-relaxed">{storyboard.concept}</p>
          </div>
          <div className="flex items-center gap-2 self-start">
            <button
              onClick={() => setProductionMode("auto-merge")}
              className="flex items-center gap-1.5 rounded-xl bg-[#0c152d] border border-blue-500/40 px-4 py-2 text-xs font-semibold text-blue-400 hover:bg-[#131d35] hover:border-blue-400 transition-colors"
            >
              <Tv size={12} /> Open Timeline Editor
            </button>
            <button
              onClick={resetDraft}
              className="flex items-center gap-1.5 rounded-xl bg-white/5 border border-white/5 px-4 py-2 text-xs font-semibold hover:bg-white/10 transition-colors"
            >
              <Undo2 size={12} /> Reset Draft
            </button>
          </div>
        </div>

        {/* Director settings / Locks Block */}
        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="rounded-xl border border-white/5 bg-surface/80 p-5 flex flex-col">
            <span className="text-[11px] font-bold text-white tracking-wider uppercase">Locked Character Block (LCB)</span>
            <p className="mt-1 text-[11px] text-neutral-500 leading-relaxed mb-3">
              Maintains face and physical geometry consistency verbatim across scenes.
            </p>
            <textarea
              value={storyboard.characterLock.description}
              onChange={(e) =>
                setStoryboard({
                  ...storyboard,
                  characterLock: { ...storyboard.characterLock, description: e.target.value },
                })
              }
              rows={4}
              className="w-full bg-background rounded-xl border border-white/5 p-3.5 text-xs leading-relaxed focus:border-blue-500/40 outline-none text-white font-mono"
            />
            <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <span className="text-[9px] font-bold text-neutral-500 uppercase">Actor Subject</span>
                <input
                  value={storyboard.characterLock.name}
                  onChange={(e) =>
                    setStoryboard({
                      ...storyboard,
                      characterLock: { ...storyboard.characterLock, name: e.target.value },
                    })
                  }
                  className="mt-1 w-full bg-background text-xs rounded-lg border border-white/5 px-3 py-1.5 text-white font-semibold focus:border-blue-500/40 outline-none"
                />
              </div>
              <div>
                <span className="text-[9px] font-bold text-neutral-500 uppercase">Locked Wardrobe</span>
                <input
                  value={storyboard.characterLock.wardrobe}
                  onChange={(e) =>
                    setStoryboard({
                      ...storyboard,
                      characterLock: { ...storyboard.characterLock, wardrobe: e.target.value },
                    })
                  }
                  className="mt-1 w-full bg-background text-xs rounded-lg border border-white/5 px-3 py-1.5 text-white font-semibold focus:border-blue-500/40 outline-none"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-white/5 bg-surface/80 p-5 flex flex-col">
            <span className="text-[11px] font-bold text-white tracking-wider uppercase">Visual Style Contract</span>
            <p className="mt-1 text-[11px] text-neutral-500 leading-relaxed mb-3">
              Optical, lens, and grain parameters applied consistently to every output.
            </p>
            <textarea
              value={storyboard.styleHeader}
              onChange={(e) => setStoryboard({ ...storyboard, styleHeader: e.target.value })}
              rows={6}
              className="w-full flex-1 bg-background rounded-xl border border-white/5 p-3.5 text-xs leading-relaxed focus:border-blue-500/40 outline-none text-white font-mono"
            />
          </div>
        </div>

        {/* Scene Cards Header */}
        <div className="mt-10 flex items-center gap-3 border-b border-white/5 pb-3">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-[#0c152d] border border-blue-500/30 text-blue-400">
            <Tv size={12} />
          </span>
          <h3 className="text-base font-bold text-white tracking-tight">Scene Generation Panel</h3>
        </div>

        {/* GRID OF SCENE CARDS */}
        <div className="mt-5 flex flex-col gap-6">
          {storyboard.scenes.map((scene, idx) => {
            const status = videoStatus[idx] || { status: "idle", revisionInput: "" };
            return (
              <div
                key={scene.sceneNumber}
                className="rounded-2xl border border-white/5 bg-gradient-to-b from-[#0c152d] to-[#080d1c] p-5 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start hover:border-blue-500/30 transition-colors"
              >
                {/* Scene description columns */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-[#131d35] px-2 py-0.5 rounded-full border border-white/10">
                      Scene {scene.sceneNumber} — 10s Clip
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                    <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3.5">
                      <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wide">Setting Environment</span>
                      <p className="mt-1 text-xs text-neutral-300 leading-relaxed">{scene.setting}</p>
                    </div>

                    <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3.5">
                      <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wide">Diegetic Audio / Sound Spec</span>
                      <p className="mt-1 text-xs text-neutral-300 leading-relaxed">{scene.sound}</p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-white/[0.02] border border-white/5 p-3.5">
                    <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wide">Action Beats Sequence (Verbs)</span>
                    <p className="mt-1 text-xs text-neutral-300 leading-relaxed">{scene.action}</p>
                  </div>

                  {scene.dialogue && (
                    <div className="rounded-xl bg-blue-500/5 border border-blue-500/15 p-3.5">
                      <span className="text-[9px] font-bold text-blue-400 uppercase tracking-wide">Dialogue/Speech Track</span>
                      <p className="mt-1 text-xs italic text-neutral-200 leading-relaxed">&quot;{scene.dialogue}&quot;</p>
                    </div>
                  )}

                  {/* Prompts Panel */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wide">Copy-Ready Compiled Prompt (Blocks 1-14)</span>
                      <button
                        onClick={() => copyToClipboard(status.customPrompt || scene.fullPrompt, idx)}
                        className="flex items-center gap-1 text-xs text-neutral-500 hover:text-blue-400 transition-colors"
                      >
                        <Copy size={11} />
                        {copiedIndex === idx ? "Copied" : "Copy Prompt"}
                      </button>
                    </div>

                    {status.editingPrompt ? (
                      <textarea
                        value={status.customPrompt || scene.fullPrompt}
                        onChange={(e) =>
                          setVideoStatus((prev) => ({
                            ...prev,
                            [idx]: { ...prev[idx], customPrompt: e.target.value },
                          }))
                        }
                        rows={5}
                        className="w-full bg-background rounded-xl border border-blue-500/30 p-3 text-xs leading-relaxed outline-none text-white font-mono"
                      />
                    ) : (
                      <div className="relative rounded-xl border border-white/5 bg-background p-3.5 font-mono text-[11px] text-neutral-400 max-h-32 overflow-y-auto leading-relaxed whitespace-pre-line">
                        {status.customPrompt || scene.fullPrompt}
                      </div>
                    )}

                    <button
                      onClick={() =>
                        setVideoStatus((prev) => ({
                          ...prev,
                          [idx]: {
                            ...prev[idx],
                            editingPrompt: !prev[idx]?.editingPrompt,
                            customPrompt: prev[idx]?.customPrompt || scene.fullPrompt,
                          },
                        }))
                      }
                      className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-blue-400 transition-colors"
                    >
                      <Edit3 size={11} />
                      {status.editingPrompt ? "Save Prompt Edit" : "Manually Edit Prompt Block"}
                    </button>
                  </div>

                  {/* REVISION ENGINE INPUT */}
                  <div className="flex items-center gap-2 rounded-xl bg-background border border-white/5 px-3 py-1.5 focus-within:border-blue-500/40 transition-colors">
                    <input
                      value={status.revisionInput || ""}
                      onChange={(e) =>
                        setVideoStatus((prev) => ({
                          ...prev,
                          [idx]: { ...prev[idx], revisionInput: e.target.value },
                        }))
                      }
                      placeholder="Request scene rewrite (e.g. change shirt color, add rain, pan left)..."
                      disabled={status.revising}
                      className="w-full bg-transparent text-xs outline-none text-white placeholder:text-neutral-700 disabled:opacity-50"
                    />
                    <button
                      onClick={() => reviseScenePrompt(idx)}
                      disabled={status.revising || !status.revisionInput?.trim()}
                      className="shrink-0 flex items-center gap-1 rounded-lg bg-[#131d35] hover:bg-blue-600 disabled:bg-[#131d35] disabled:text-neutral-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                    >
                      {status.revising ? (
                        <>
                          <RefreshCw size={11} className="animate-spin" /> Rewriting...
                        </>
                      ) : (
                        <>
                          <Wand2 size={11} /> Rewrite Scene
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Rendering player and controller column */}
                <div className="lg:col-span-5 flex flex-col justify-center h-full">
                  {status.status === "idle" && (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.01] px-6 py-14 text-center">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#0e1630] text-neutral-500 mb-3 border border-white/10">
                        <Video size={16} />
                      </span>
                      <h4 className="text-xs font-bold text-white">Video Draft Offline</h4>
                      <p className="mt-1 text-[11px] text-neutral-500 max-w-xs leading-normal">
                        Trigger the high-motion Gemini Omni Flash engine to render this prompt block.
                      </p>
                      <button
                        onClick={() => generateVideoForScene(idx, status.customPrompt || scene.fullPrompt)}
                        className="mt-4.5 flex items-center gap-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-500 px-5 py-2 text-xs font-bold transition-all shadow-lg shadow-blue-500/20"
                      >
                        <Play size={11} fill="white" /> Generate Scene Video
                      </button>
                    </div>
                  )}

                  {status.status === "rendering" && (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-blue-500/20 bg-[#0c152d]/40 px-6 py-14 text-center">
                      <RefreshCw size={28} className="text-blue-400 animate-spin" />
                      <h4 className="mt-3 text-xs font-bold text-white">Generating Clip...</h4>
                      <p className="mt-2 text-[10px] text-neutral-500 leading-relaxed max-w-xs">
                        Gemini Omni Flash is compiling files. This usually takes 1-3 minutes.
                      </p>
                    </div>
                  )}

                  {status.status === "succeeded" && status.url && (
                    <div className="space-y-3">
                      <div className="relative aspect-video overflow-hidden rounded-xl bg-black border border-white/10 shadow-2xl">
                        <video src={status.url} controls className="h-full w-full object-cover" />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/5 px-2.5 py-0.5 rounded-full border border-emerald-500/15">
                          <CheckCircle size={11} /> Render Successful
                        </span>
                        <button
                          onClick={() => generateVideoForScene(idx, status.customPrompt || scene.fullPrompt)}
                          className="flex items-center gap-1 text-[11px] font-semibold text-neutral-500 hover:text-blue-400 transition-colors"
                        >
                          <RefreshCw size={11} /> Re-render Video
                        </button>
                      </div>
                    </div>
                  )}

                  {status.status === "failed" && (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-red-500/10 bg-red-500/[0.005] px-6 py-10 text-center">
                      <AlertCircle size={24} className="text-red-400" />
                      <h4 className="mt-2.5 text-xs font-bold text-white">Generation Failed</h4>
                      <p className="mt-1 text-[10px] text-red-400 max-w-xs leading-normal">{status.error || "GCP Operation timed out"}</p>
                      <button
                        onClick={() => generateVideoForScene(idx, status.customPrompt || scene.fullPrompt)}
                        className="mt-3.5 flex items-center gap-1 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 px-3.5 py-1.5 text-xs font-semibold transition-colors"
                      >
                        <RefreshCw size={11} /> Retry Generation
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
