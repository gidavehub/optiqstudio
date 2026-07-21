"use client";

import React from "react";
import {
  Clapperboard, X, Mic, MicOff, Upload, Play, RefreshCw,
  ChevronRight, ChevronLeft, Check, Paperclip, AlertCircle, Zap,
  Monitor, Smartphone, Plus,
} from "lucide-react";
import { useEditorFlow } from "../_flow/EditorFlowProvider";
import { LENGTH_PRICING_GMD, ProjectLength, DictationTarget } from "../_flow/types";
import HoverPreviewVideo from "../_shared/HoverPreviewVideo";
import StoryboardPaywallModal from "./StoryboardPaywallModal";

const STEP_COUNT = 7;

// One mic pipeline for every text field in the flow. Declared outside the
// wizard so it isn't re-created (and state-reset) on every render.
function MicButton({
  target,
  recording,
  recordingTarget,
  startSpeechRecognition,
  stopSpeechRecognition,
}: {
  target: DictationTarget;
  recording: boolean;
  recordingTarget: DictationTarget | null;
  startSpeechRecognition: (target?: DictationTarget) => void;
  stopSpeechRecognition: () => void;
}) {
  const active = recording && recordingTarget === target;
  return active ? (
    <button
      type="button"
      onClick={stopSpeechRecognition}
      className="flex items-center gap-1.5 bg-red-600/20 border border-red-500/20 rounded-xl px-3 py-2 text-[11px] font-bold text-red-400 animate-pulse transition-all"
    >
      <MicOff size={12} /> Stop
    </button>
  ) : (
    <button
      type="button"
      onClick={() => startSpeechRecognition(target)}
      disabled={recording}
      className="flex items-center gap-1.5 bg-white/5 border border-white/5 hover:border-white/10 rounded-xl px-3 py-2 text-[11px] font-bold text-neutral-400 hover:text-white transition-all disabled:opacity-40"
    >
      <Mic size={12} className="text-blue-400" /> Voice
    </button>
  );
}

export default function StoryboardWizard() {
  const {
    goHome,
    wizardStep, setWizardStep,
    generating,
    length, setLength,
    projects, projectsLoading, openProject, deleteProject,
    promptText, setPromptText,
    recording, recordingTarget, startSpeechRecognition, stopSpeechRecognition,
    aspectRatio, setAspectRatio,
    brandName, setBrandName,
    product, setProduct,
    brandMaterials, isDragging, setIsDragging, handleDrop, handleMaterialsUpload, removeBrandMaterial,
    error, setStoryboardPayOpen,
  } = useEditorFlow();

  const canContinue =
    wizardStep === 3 ? !!promptText.trim()
    : wizardStep === 5 ? !!brandName.trim()
    : wizardStep === 6 ? !!product.trim()
    : true;

  const goNext = () => {
    if (wizardStep < STEP_COUNT) setWizardStep((wizardStep + 1) as typeof wizardStep);
  };
  const goBack = () => {
    if (wizardStep === 1) goHome();
    else setWizardStep((wizardStep - 1) as typeof wizardStep);
  };

  const micProps = { recording, recordingTarget, startSpeechRecognition, stopSpeechRecognition };

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-background text-neutral-200">
      {/* Cinematic backdrop for the vision step */}
      {wizardStep === 3 && !generating && (
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div
            className="h-full w-full bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: "url('/media/storyboard_cinematic_bg.png')" }}
          />
          <div className="absolute inset-0 bg-[#0a0f1d]/80 backdrop-blur-[2px]" />
        </div>
      )}

      {/* ── TOP BAR ── */}
      {/* pt-16 clears the FloatingChrome pills fixed along the top edge */}
      <header className="relative z-10 flex shrink-0 items-center justify-between px-4 sm:px-6 pt-16 pb-2">
        <button
          onClick={goHome}
          className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-white transition-colors"
        >
          <ChevronLeft size={14} /> Back to Portal
        </button>
        <h2 className="hidden sm:block text-sm font-bold text-white tracking-tight">Storyboard Configuration</h2>
        <div className="flex gap-1.5">
          {Array.from({ length: STEP_COUNT }, (_, i) => i + 1).map((s) => (
            <span
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                wizardStep === s ? "bg-white w-8" : s < wizardStep ? "bg-blue-500/70 w-4" : "bg-[#131d35] w-4"
              }`}
            />
          ))}
        </div>
      </header>

      {/* ── STEP CONTENT (always one viewport height, scrolls only as a safety net) ── */}
      <main className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto px-4 sm:px-6">
        {generating ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="relative h-44 w-72 sm:h-52 sm:w-96 overflow-hidden rounded-3xl border border-white/10 bg-black shadow-[0_24px_80px_rgba(0,0,0,0.7)]">
              <div className="aurora" aria-hidden />
              <div className="aurora-veil" aria-hidden />
            </div>
            <h3 className="mt-5 text-sm font-bold text-white">Optiq Skills are writing your story…</h3>
            <p className="mt-1.5 text-xs text-neutral-500 max-w-xs">
              A swarm of agents is crafting your storyline, cast and every scene. This takes a minute or two.
            </p>
          </div>
        ) : (
          <>
            {/* STEP 1 — PROJECT LAUNCHER
                Start a new film, or reopen an old one. Nothing else. This is
                the only step that can exceed a viewport, so it flows naturally
                and the page itself is the scroll surface. */}
            {wizardStep === 1 && (
              <div className="mx-auto w-full max-w-3xl space-y-8 pt-2 pb-6">
                {/* Create new — blurred cinematic card, same treatment as the
                    landing page's developer-engine band */}
                <button
                  onClick={() => setWizardStep(2)}
                  className="group relative block w-full overflow-hidden rounded-2xl border-2 border-dashed border-white/20 hover:border-blue-400/60 transition-all duration-300 active:scale-[0.99]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/media/research-bg.jpg"
                    alt=""
                    aria-hidden
                    className="absolute inset-0 h-full w-full scale-125 object-cover opacity-90 blur-[70px]"
                  />
                  <div className="absolute inset-0 bg-black/35 group-hover:bg-black/25 transition-colors" />

                  <div className="relative flex flex-col items-center justify-center gap-3 px-6 py-14 sm:py-20 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/25 bg-white/10 text-white backdrop-blur-sm group-hover:scale-110 transition-transform duration-300">
                      <Plus size={24} />
                    </span>
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow">
                      Create new project
                    </h1>
                    <p className="max-w-sm text-xs sm:text-[13px] text-white/70 leading-relaxed">
                      Describe your brand and let the Optiq Skills agents write, cast and shoot the whole ad.
                    </p>
                  </div>
                </button>

                {/* Past projects — full height, the page scrolls */}
                <div className="pt-2">
                  <h4 className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-neutral-500 animate-pulse" />
                    Past Storyboard Projects
                  </h4>
                  {projectsLoading ? (
                    <div className="flex items-center gap-2 py-8 justify-center text-xs text-neutral-500 font-mono uppercase tracking-wider">
                      <RefreshCw size={12} className="animate-spin" /> Loading Projects...
                    </div>
                  ) : projects.length === 0 ? (
                    <div className="mt-4 rounded-xl border border-dashed border-white/5 bg-[#0c152d]/20 py-8 px-4 text-center">
                      <Clapperboard size={18} className="text-neutral-600 mx-auto mb-1.5" />
                      <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-mono">No past projects yet</p>
                    </div>
                  ) : (
                    <div className="mt-4 grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3">
                      {projects.map((proj) => {
                        const clipUrl =
                          proj.compileVideoUrl ||
                          (Object.values(proj.videoStatus || {}) as { url?: string }[])
                            .map((s) => s?.url)
                            .find(Boolean) ||
                          "";
                        return (
                          <div
                            key={proj.id}
                            onClick={() => openProject(proj)}
                            className="group relative aspect-video overflow-hidden rounded-xl border border-white/5 bg-[#0c152d] cursor-pointer transition-all duration-300 hover:border-blue-500/60 shadow-lg"
                          >
                            {clipUrl ? (
                              <HoverPreviewVideo
                                src={clipUrl}
                                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                                fallback={
                                  <div className="media-fallback absolute inset-0 flex items-center justify-center">
                                    <Clapperboard size={18} className="text-neutral-600" />
                                  </div>
                                }
                              />
                            ) : (
                              <div className="media-fallback absolute inset-0 flex items-center justify-center">
                                <Clapperboard size={18} className="text-neutral-600" />
                              </div>
                            )}
                            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[#0a0f1d]/65 backdrop-blur-md opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                              <div className="rounded-full border border-white/20 bg-white/10 p-2 scale-90 transition-all duration-300 group-hover:scale-100">
                                <Play size={14} className="text-white" />
                              </div>
                              <span className="rounded bg-[#0c152d]/80 border border-white/10 px-1.5 py-0.5 text-[8px] font-bold font-mono uppercase tracking-wider text-blue-400">
                                {proj.length}
                              </span>
                            </div>
                            <button
                              onClick={(e) => deleteProject(e, proj.id)}
                              className="absolute top-2 right-2 z-20 rounded-full bg-[#0a0f1d]/70 border border-white/10 p-1 text-neutral-400 opacity-0 transition-all hover:text-red-400 group-hover:opacity-100"
                              title="Delete Storyboard Project"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 2 — RUN-TIME (its own screen, nothing competing) */}
            {wizardStep === 2 && (
              <div className="flex flex-1 flex-col items-center justify-center gap-8 mx-auto w-full max-w-2xl">
                <div className="text-center">
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">How long should your ad run?</h1>
                  <p className="mt-1.5 text-xs text-neutral-500">Every scene is 10 seconds of finished video.</p>
                </div>

                <div className="grid w-full grid-cols-3 gap-3 sm:gap-4">
                  {(
                    [
                      { id: "30s", title: "30s", subtitle: "3 Scenes", desc: "Sleek, rapid ad" },
                      { id: "60s", title: "60s", subtitle: "6 Scenes", desc: "Standard campaign" },
                      { id: "90s", title: "90s", subtitle: "9 Scenes", desc: "Longform story" },
                    ] as { id: ProjectLength; title: string; subtitle: string; desc: string }[]
                  ).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setLength(item.id)}
                      className={`group flex flex-col items-center rounded-2xl border px-2 py-6 sm:py-9 text-center transition-all duration-300 active:scale-[0.98] ${
                        length === item.id
                          ? "border-blue-500 bg-[#0c152d] text-white"
                          : "border-white/5 bg-surface-2 hover:border-white/10 hover:bg-[#131d35]"
                      }`}
                    >
                      <span className="text-[9px] sm:text-[10px] font-bold text-neutral-400 tracking-wider uppercase">{item.subtitle}</span>
                      <span className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight group-hover:text-blue-400 transition-colors">
                        {item.title}
                      </span>
                      <p className="mt-1.5 hidden sm:block text-[11px] text-neutral-400">{item.desc}</p>
                      <span className={`mt-2.5 text-[11px] font-bold tracking-tight ${length === item.id ? "text-blue-400" : "text-neutral-500"}`}>
                        GMD {LENGTH_PRICING_GMD[item.id].toFixed(2)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 3 — DIRECT YOUR VISION */}
            {wizardStep === 3 && (
              <div className="flex flex-1 flex-col items-center justify-center gap-6 mx-auto w-full max-w-2xl">
                <h1 className="text-3xl sm:text-5xl font-black tracking-widest text-white uppercase text-center select-none drop-shadow-2xl">
                  Direct Your Vision
                </h1>
                <p className="text-xs text-neutral-400 text-center max-w-md -mt-3">
                  Tell us about the ad you want — the brand, the feeling, the audience. Our agents turn it into a story.
                </p>
                <div className="w-full rounded-3xl border border-white/10 bg-[#0e1630]/75 backdrop-blur-xl p-4 shadow-2xl transition-all duration-300 focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/10">
                  <textarea
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    placeholder="Type a prompt..."
                    rows={5}
                    className="w-full bg-transparent resize-none outline-none text-sm placeholder:text-neutral-500 leading-relaxed text-white"
                  />
                  <div className="mt-2 border-t border-white/5 pt-3 flex items-center justify-between">
                    <MicButton target="prompt" {...micProps} />
                    <span className="text-[10px] text-neutral-500 font-mono">{length} · {length === "30s" ? 3 : length === "60s" ? 6 : 9} scenes</span>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4 — ORIENTATION */}
            {wizardStep === 4 && (
              <div className="flex flex-1 flex-col items-center justify-center gap-6 mx-auto w-full max-w-2xl">
                <div className="text-center">
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">Pick your canvas</h1>
                  <p className="mt-1 text-xs text-neutral-500">Where will this ad live?</p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-6 w-full">
                  {[
                    {
                      id: "16:9",
                      title: "Landscape",
                      sub: "16:9 — TV, YouTube, web",
                      icon: <Monitor size={16} className="text-blue-400" />,
                      frame: <div className="h-[72px] w-32 sm:h-[90px] sm:w-40 rounded-lg border-2 border-current" />,
                    },
                    {
                      id: "9:16",
                      title: "Portrait",
                      sub: "9:16 — TikTok, Reels, Stories",
                      icon: <Smartphone size={16} className="text-blue-400" />,
                      frame: <div className="h-32 w-[72px] sm:h-40 sm:w-[90px] rounded-lg border-2 border-current" />,
                    },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setAspectRatio(opt.id)}
                      className={`relative flex flex-col items-center gap-3 rounded-2xl border px-4 py-6 sm:py-8 transition-all duration-300 ${
                        aspectRatio === opt.id
                          ? "border-blue-500 bg-[#0c152d] text-white ring-2 ring-blue-500/25"
                          : "border-white/5 bg-surface-2 text-neutral-500 hover:border-white/10 hover:text-neutral-300"
                      }`}
                    >
                      {aspectRatio === opt.id && (
                        <span className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-white border border-white/20 shadow-md">
                          <Check size={11} />
                        </span>
                      )}
                      <div className="flex h-32 sm:h-40 items-center">{opt.frame}</div>
                      <div className="flex items-center gap-1.5 text-sm font-extrabold tracking-tight text-white">
                        {opt.icon} {opt.title}
                      </div>
                      <p className="text-[10px] text-neutral-500 -mt-2">{opt.sub}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 5 — BRAND NAME */}
            {wizardStep === 5 && (
              <div className="flex flex-1 flex-col items-center justify-center gap-6 mx-auto w-full max-w-xl">
                <div className="text-center">
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">What is your brand called?</h1>
                  <p className="mt-1 text-xs text-neutral-500">Your brand or company name, exactly as it should appear.</p>
                </div>
                <div className="w-full rounded-3xl border border-white/10 bg-[#0e1630]/75 backdrop-blur-xl p-4 shadow-2xl transition-all duration-300 focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/10">
                  <input
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="e.g. Sidrah Salaam"
                    autoFocus
                    className="w-full bg-transparent outline-none text-lg sm:text-xl font-bold placeholder:text-neutral-600 placeholder:font-normal text-white text-center py-2"
                  />
                  <div className="mt-2 border-t border-white/5 pt-3 flex justify-center">
                    <MicButton target="brand" {...micProps} />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 6 — PRODUCT / SERVICE */}
            {wizardStep === 6 && (
              <div className="flex flex-1 flex-col items-center justify-center gap-6 mx-auto w-full max-w-xl">
                <div className="text-center">
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">What are you selling?</h1>
                  <p className="mt-1 text-xs text-neutral-500">Your main product or service — the hero of the story.</p>
                </div>
                <div className="w-full rounded-3xl border border-white/10 bg-[#0e1630]/75 backdrop-blur-xl p-4 shadow-2xl transition-all duration-300 focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/10">
                  <textarea
                    value={product}
                    onChange={(e) => setProduct(e.target.value)}
                    placeholder="e.g. Deygeh groundnut paste — 4.5kg tubs for families and restaurants"
                    rows={3}
                    autoFocus
                    className="w-full bg-transparent resize-none outline-none text-sm placeholder:text-neutral-500 leading-relaxed text-white"
                  />
                  <div className="mt-2 border-t border-white/5 pt-3 flex justify-center">
                    <MicButton target="product" {...micProps} />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 7 — BRAND MATERIALS */}
            {wizardStep === 7 && (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 mx-auto w-full max-w-xl">
                <div className="text-center">
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">Brand materials</h1>
                  <p className="mt-1.5 text-xs text-neutral-400 max-w-md mx-auto">
                    <strong className="text-white">Upload your logo or images of your product.</strong> If you have none, that&apos;s fine — skip straight to generate.
                  </p>
                </div>

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    handleDrop(e);
                  }}
                  className={`w-full rounded-2xl border border-dashed p-6 sm:p-8 text-center transition-all duration-300 ${
                    isDragging
                      ? "border-blue-500/40 bg-[#0e1630]/50 shadow-lg scale-[1.01]"
                      : "border-white/10 bg-surface hover:border-white/15"
                  }`}
                >
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    id="materials-upload"
                    onChange={handleMaterialsUpload}
                    className="hidden"
                  />
                  <label htmlFor="materials-upload" className="cursor-pointer flex flex-col items-center justify-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0e1630] border border-white/10 text-neutral-400 mb-2">
                      <Upload size={15} />
                    </span>
                    <span className="text-sm font-bold text-white">Logo &amp; product images</span>
                    <span className="mt-1 text-[10px] text-neutral-500">PNG, JPG or SVG — drag &amp; drop or tap to browse</span>
                  </label>
                </div>

                {brandMaterials.length > 0 && (
                  <div className="flex flex-wrap gap-2 justify-center max-h-[12dvh] overflow-y-auto">
                    {brandMaterials.map((file, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-400"
                      >
                        <Paperclip size={10} />
                        <span className="max-w-[120px] truncate">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeBrandMaterial(i)}
                          className="text-neutral-500 hover:text-red-400 font-bold ml-1 text-xs"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="w-full rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 flex gap-2.5 items-start">
                  <AlertCircle size={14} className="shrink-0 mt-0.5 text-amber-400" />
                  <p className="text-[11px] leading-relaxed text-amber-200/90">
                    <strong className="text-amber-300">Please do not upload images of real people.</strong> Every person in your ad
                    is generated with AI — uploading someone&apos;s photo without consent violates our privacy policy. A person printed
                    on your own product&apos;s packaging is fine.
                  </p>
                </div>

                {error && (
                  <div className="w-full rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 flex gap-2.5 text-xs text-red-400 items-start">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* ── BOTTOM NAV (in-flow, so every step is exactly one viewport) ── */}
      {!generating && (
        <footer className="relative z-10 shrink-0 px-4 pb-4 pt-2 flex justify-center">
          <div className="flex items-center gap-4 sm:gap-6 rounded-2xl border border-white/5 bg-surface/85 backdrop-blur-xl px-4 sm:px-6 py-3 shadow-2xl shadow-black/95 w-full max-w-xl justify-between">
            <button
              onClick={goBack}
              className="flex items-center gap-1.5 rounded-xl bg-white/5 hover:bg-white/10 px-4 py-2.5 text-xs font-semibold text-neutral-300 transition-colors border border-white/5"
            >
              <ChevronLeft size={13} /> Back
            </button>

            <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest hidden sm:block">
              Step {wizardStep} / {STEP_COUNT}
            </span>

            {/* Step 1's call to action is the "Create new project" card
                itself, so no duplicate Continue button competes with it. */}
            {wizardStep === 1 ? (
              <span className="text-[10px] font-mono text-neutral-600 uppercase tracking-widest">
                Pick up where you left off
              </span>
            ) : wizardStep < STEP_COUNT ? (
              <button
                disabled={!canContinue}
                onClick={goNext}
                className={`flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-bold transition-all shadow-lg ${
                  canContinue
                    ? "bg-white hover:bg-neutral-200 text-black cursor-pointer"
                    : "bg-[#0e1630] border border-white/5 text-neutral-600 cursor-not-allowed opacity-50 shadow-none"
                }`}
              >
                Continue <ChevronRight size={13} />
              </button>
            ) : (
              <button
                onClick={() => setStoryboardPayOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-white hover:bg-neutral-200 px-5 py-2.5 text-xs font-bold text-black transition-all"
              >
                <Zap size={13} /> Generate Spec
              </button>
            )}
          </div>
        </footer>
      )}

      <StoryboardPaywallModal />
    </div>
  );
}
