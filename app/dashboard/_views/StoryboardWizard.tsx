"use client";

import React, { useState } from "react";
import {
  Clapperboard, X, Mic, MicOff, Upload, Play, RefreshCw,
  ChevronRight, ChevronLeft, Check, Paperclip, AlertCircle, Zap,
  Monitor, Smartphone, Plus,
} from "lucide-react";
import { useEditorFlow } from "../_flow/EditorFlowProvider";
import {
  LENGTH_PRICING_GMD, DictationTarget, WizardStepId,
  VIDEO_TYPE_CARDS, SHORT_FILM_MODES, isShortFilm, wizardStepsFor,
  scenesForLength, videoType, formatRunTime, formatRunTimeRange,
} from "../_flow/types";
import HoverPreviewVideo from "../_shared/HoverPreviewVideo";
import { gridBox } from "../_shared/aspect";
import StoryboardPaywallModal from "./StoryboardPaywallModal";

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
      className="flex items-center gap-1.5 bg-danger-soft border border-danger rounded-2xl px-3 py-2 text-[11px] font-bold text-danger animate-pulse transition-all"
    >
      <MicOff size={12} /> Stop
    </button>
  ) : (
    <button
      type="button"
      onClick={() => startSpeechRecognition(target)}
      disabled={recording}
      className="flex items-center gap-1.5 bg-surface border border-line hover:border-line rounded-2xl px-3 py-2 text-[11px] font-bold text-ink-3 hover:text-foreground transition-all disabled:opacity-40"
    >
      <Mic size={12} className="text-accent-ink" /> Voice
    </button>
  );
}

export default function StoryboardWizard() {
  const {
    goHome,
    wizardStep, setWizardStep,
    generating,
    length, setLength,
    videoTypeId, selectVideoType,
    projects, projectsLoading, openProject, deleteProject,
    promptText, setPromptText,
    recording, recordingTarget, startSpeechRecognition, stopSpeechRecognition,
    aspectRatio, setAspectRatio,
    brandName, setBrandName,
    product, setProduct,
    brandMaterials, isDragging, setIsDragging, handleDrop, handleMaterialsUpload, removeBrandMaterial,
    error, setStoryboardPayOpen,
  } = useEditorFlow();

  // Past projects are video tiles; mounting every one of them is what made this
  // screen crawl for accounts with a long history. Six at a time, more on tap.
  const PROJECT_PAGE = 6;
  const [visibleProjects, setVisibleProjects] = useState(PROJECT_PAGE);
  const shownProjects = projects.slice(0, visibleProjects);
  const remainingProjects = projects.length - shownProjects.length;

  const chosenType = videoType(videoTypeId);
  /** A film with nothing to sell: no brand, no product, no materials to upload. */
  const isStory = !chosenType.branded;

  // The flow is a LIST, not a count. An original story is three screens shorter
  // than an ad, and the short-film types carry an extra one — so "step 4" is not
  // a stable idea and the wizard no longer pretends it is.
  const steps = wizardStepsFor(videoTypeId);
  const stepIndex = Math.max(0, steps.indexOf(wizardStep));
  const isLastStep = stepIndex === steps.length - 1;
  const at = (id: WizardStepId) => wizardStep === id;

  const canContinue =
    at("vision") ? !!promptText.trim()
    : at("brand") ? !!brandName.trim()
    : at("product") ? !!product.trim()
    : true;

  const goNext = () => {
    if (!isLastStep) setWizardStep(steps[stepIndex + 1]);
  };
  const goBack = () => {
    if (stepIndex === 0) goHome();
    else setWizardStep(steps[stepIndex - 1]);
  };

  const micProps = { recording, recordingTarget, startSpeechRecognition, stopSpeechRecognition };

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      {/* Cinematic backdrop for the vision step */}
      {at("vision") && !generating && (
        <div className="absolute inset-0 z-0 pointer-events-none">
          <div
            className="h-full w-full bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: "url('/media/storyboard_cinematic_bg.png')" }}
          />
          <div className="absolute inset-0 bg-surface/85 backdrop-blur-[2px]" />
        </div>
      )}

      {/* ── TOP BAR ── */}
      {/* pt-16 clears the FloatingChrome pills fixed along the top edge */}
      <header className="relative z-10 flex shrink-0 items-center justify-between px-4 sm:px-6 pt-16 pb-2">
        <button
          onClick={goHome}
          className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors"
        >
          <ChevronLeft size={14} /> Back to Portal
        </button>
        <h2 className="hidden sm:block text-sm font-bold text-foreground tracking-tight">Storyboard Configuration</h2>
        <div className="flex gap-1.5">
          {steps.map((s, i) => (
            <span
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === stepIndex ? "bg-foreground w-8" : i < stepIndex ? "bg-accent w-4" : "bg-surface-2 w-4"
              }`}
            />
          ))}
        </div>
      </header>

      {/* ── STEP CONTENT (always one viewport height, scrolls only as a safety net) ── */}
      <main className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto px-4 sm:px-6">
        {generating ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <div className="relative h-44 w-72 sm:h-52 sm:w-96 overflow-hidden rounded-[28px] border border-line bg-background shadow-[0_24px_60px_rgba(16,24,40,0.12)]">
              <div className="aurora" aria-hidden />
              <div className="aurora-veil" aria-hidden />
            </div>
            <h3 className="mt-5 text-sm font-bold text-foreground">Optiq Skills are writing your story…</h3>
            <p className="mt-1.5 text-xs text-muted max-w-xs">
              A swarm of agents is crafting your storyline, cast and every scene. This takes a minute or two.
            </p>
          </div>
        ) : (
          <>
            {/* STEP 1 — PROJECT LAUNCHER
                Start a new film, or reopen an old one. Nothing else. This is
                the only step that can exceed a viewport, so it flows naturally
                and the page itself is the scroll surface. */}
            {at("projects") && (
              <div className="mx-auto w-full max-w-3xl space-y-8 pt-2 pb-6">
                {/* Create new — blurred cinematic card, same treatment as the
                    landing page's developer-engine band */}
                <button
                  onClick={() => setWizardStep("type")}
                  className="group relative block w-full overflow-hidden rounded-3xl border-2 border-dashed border-line-2 hover:border-accent transition-all duration-300 active:scale-[0.99]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/media/research-bg.jpg"
                    alt=""
                    aria-hidden
                    className="absolute inset-0 h-full w-full scale-125 object-cover opacity-90 blur-[70px]"
                  />
                  <div className="absolute inset-0 bg-background/30 group-hover:bg-background/15 transition-colors" />

                  <div className="relative flex flex-col items-center justify-center gap-3 px-6 py-14 sm:py-20 text-center">
                    <span className="flex h-14 w-14 items-center justify-center rounded-3xl border border-line-2 bg-surface-2 text-foreground backdrop-blur-sm group-hover:scale-110 transition-transform duration-300">
                      <Plus size={24} />
                    </span>
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground drop-shadow">
                      Create new project
                    </h1>
                    <p className="max-w-sm text-xs sm:text-[13px] text-ink-3 leading-relaxed">
                      Describe it once and let the Optiq agents write, cast and shoot the whole film.
                    </p>
                  </div>
                </button>

                {/* Past projects — full height, the page scrolls */}
                <div className="pt-2">
                  <h4 className="text-[10px] font-bold text-ink-3 uppercase tracking-widest tabular-nums flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-surface-3 animate-pulse" />
                    Past Storyboard Projects
                  </h4>
                  {projectsLoading ? (
                    <div className="flex items-center gap-2 py-8 justify-center text-xs text-muted tabular-nums uppercase tracking-wider">
                      <RefreshCw size={12} className="animate-spin" /> Loading Projects...
                    </div>
                  ) : projects.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-dashed border-line bg-surface py-8 px-4 text-center">
                      <Clapperboard size={18} className="text-faint mx-auto mb-1.5" />
                      <p className="text-[10px] text-muted uppercase tracking-widest tabular-nums">No past projects yet</p>
                    </div>
                  ) : (
                    <div className="mt-4 grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-3">
                      {shownProjects.map((proj) => {
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
                            style={gridBox(proj.aspectRatio).style}
                            className={`group relative overflow-hidden rounded-2xl border border-line bg-surface cursor-pointer transition-all duration-300 hover:border-accent shadow-lg ${gridBox(proj.aspectRatio).className}`}
                          >
                            {clipUrl ? (
                              <HoverPreviewVideo
                                src={clipUrl}
                                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                                fallback={
                                  <div className="media-fallback absolute inset-0 flex items-center justify-center">
                                    <Clapperboard size={18} className="text-faint" />
                                  </div>
                                }
                              />
                            ) : (
                              <div className="media-fallback absolute inset-0 flex items-center justify-center">
                                <Clapperboard size={18} className="text-faint" />
                              </div>
                            )}
                            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/70 backdrop-blur-md opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                              <div className="rounded-full border border-line-2 bg-surface-2 p-2 scale-90 transition-all duration-300 group-hover:scale-100">
                                <Play size={14} className="text-foreground" />
                              </div>
                              <span className="rounded-xl bg-surface/85 border border-line px-1.5 py-0.5 text-[8px] font-bold tabular-nums uppercase tracking-wider text-accent-ink">
                                {proj.length}
                              </span>
                            </div>
                            <button
                              onClick={(e) => deleteProject(e, proj.id)}
                              className="absolute top-2 right-2 z-20 rounded-full bg-background/75 border border-line p-1 text-ink-3 opacity-0 transition-all hover:text-danger group-hover:opacity-100"
                              title="Delete Storyboard Project"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        );
                      })}

                      {remainingProjects > 0 && (
                        <div className="col-span-full flex justify-center pt-1">
                          <button
                            onClick={() => setVisibleProjects((v) => v + PROJECT_PAGE)}
                            className="flex items-center gap-2 rounded-full border border-line bg-surface px-6 py-2.5 text-xs font-bold text-foreground transition-all hover:border-accent hover:bg-background active:scale-95"
                          >
                            View more
                            <span className="tabular-nums text-muted">{remainingProjects}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* STEP 2 — WHAT KIND OF FILM
                Comes before the run-time because it decides which run-times are
                on offer, and it is the first real question because it changes
                how the finished cut is scored and narrated. Cards are clip-first
                like everything else in the product — the cover shows you what
                you get, the copy just confirms it. */}
            {at("type") && (
              <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6">
                <h1 className="text-center text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                  What are we making?
                </h1>

                {/* Three across at every width, phones included. These cards
                    used to be full-bleed paragraphs that pushed the picker off a
                    phone screen; the cover clip is the explanation, so the copy
                    is a title and a duration and nothing else. */}
                <div className="grid w-full grid-cols-3 gap-2 sm:gap-3">
                  {VIDEO_TYPE_CARDS.map((type) => {
                    // A short film is "chosen" from either half of the split —
                    // coming back from the mode screen having picked a story must
                    // still light this card up.
                    const active = type.id === "short-film" ? isShortFilm(videoTypeId) : videoTypeId === type.id;
                    return (
                      <button
                        key={type.id}
                        // Re-picking Short film keeps whichever half you already
                        // chose, so stepping back to check the format doesn't
                        // silently throw away "original story".
                        onClick={() =>
                          selectVideoType(
                            type.id === "short-film" && isShortFilm(videoTypeId) ? videoTypeId : type.id
                          )
                        }
                        aria-pressed={active}
                        className={`group relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-300 active:scale-[0.98] ${
                          active
                            ? "border-accent bg-surface ring-2 ring-accent-line"
                            : "border-line bg-surface-2 hover:border-line-2"
                        }`}
                      >
                        {active && (
                          <span className="absolute right-1.5 top-1.5 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white shadow-md">
                            <Check size={9} />
                          </span>
                        )}

                        {/* Cover clip. Falls back to the aurora wash while the
                            clips are missing, so the picker is never broken by
                            an absent asset. */}
                        <div className="relative aspect-square w-full overflow-hidden bg-background">
                          <HoverPreviewVideo
                            src={type.clip}
                            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                            fallback={
                              <div className="absolute inset-0">
                                <div className="aurora" aria-hidden />
                                <div className="aurora-veil" aria-hidden />
                              </div>
                            }
                          />
                        </div>

                        <div className="px-1.5 py-2 text-center sm:px-2 sm:py-2.5">
                          <h3 className="truncate text-[11px] font-bold tracking-tight text-foreground sm:text-[13px]">
                            {type.title}
                          </h3>
                          <span className="mt-0.5 block text-[9px] font-semibold tabular-nums text-muted sm:text-[10px]">
                            {formatRunTimeRange(type.lengths)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* MODE — SHORT FILM ONLY: ADVERT OR ORIGINAL STORY
                Two cards, clip-first like every other picker in the product. The
                ADVERT is first and is already selected, because it is what this
                platform has always made and what picking "Short film" already
                means — a director who wants one just presses Continue.

                The choice is not cosmetic: it routes the whole generation to a
                different storyboard system (functions/optiqSkills for the advert,
                functions/optiqStory for the story) and it removes three steps
                from the rest of this wizard. */}
            {at("mode") && (
              <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6">
                <h1 className="text-center text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                  What is this film for?
                </h1>

                {/* Capped on desktop so a mode card is the same size as a type
                    card on the screen before it. Two cards inheriting the
                    three-across container made each one half again as big, which
                    read as a different, heavier screen. Untouched on mobile,
                    where full width is right. */}
                <div className="grid w-full grid-cols-2 gap-3 sm:max-w-md sm:gap-4">
                  {SHORT_FILM_MODES.map((mode) => {
                    const active = videoTypeId === mode.id;
                    return (
                      <button
                        key={mode.id}
                        onClick={() => selectVideoType(mode.id)}
                        aria-pressed={active}
                        className={`group relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-300 active:scale-[0.98] ${
                          active
                            ? "border-accent bg-surface ring-2 ring-accent-line"
                            : "border-line bg-surface-2 hover:border-line-2"
                        }`}
                      >
                        {active && (
                          <span className="absolute right-1.5 top-1.5 z-20 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-white shadow-md">
                            <Check size={9} />
                          </span>
                        )}

                        <div className="relative aspect-square w-full overflow-hidden bg-background">
                          <HoverPreviewVideo
                            src={mode.clip}
                            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                            fallback={
                              <div className="absolute inset-0">
                                <div className="aurora" aria-hidden />
                                <div className="aurora-veil" aria-hidden />
                              </div>
                            }
                          />
                        </div>

                        <div className="px-2 py-2.5 text-center sm:px-3 sm:py-3">
                          <h3 className="truncate text-[12px] font-bold tracking-tight text-foreground sm:text-sm">
                            {mode.title}
                          </h3>
                          <span className="mt-0.5 block text-[9px] leading-snug text-muted sm:text-[10px]">
                            {mode.blurb}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* RUN-TIME (its own screen, nothing competing)
                The options come from the chosen type, so a short film offers
                60–180s and an ad offers 30–90s. */}
            {at("length") && (
              <div className="flex flex-1 flex-col items-center justify-center gap-8 mx-auto w-full max-w-3xl">
                <div className="text-center">
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                    {isShortFilm(chosenType.id) ? "How long is your film?" : "How long should your ad run?"}
                  </h1>
                  <p className="mt-1.5 text-xs text-muted">Every scene is 10 seconds of finished video.</p>
                </div>

                <div
                  className={`grid w-full gap-3 sm:gap-4 ${
                    chosenType.lengths.length > 3 ? "grid-cols-3 sm:grid-cols-5" : "grid-cols-3"
                  }`}
                >
                  {chosenType.lengths.map((id) => {
                    const scenes = scenesForLength(id);
                    return (
                      <button
                        key={id}
                        onClick={() => setLength(id)}
                        className={`group flex flex-col items-center rounded-3xl border px-2 py-6 text-center transition-all duration-300 active:scale-[0.98] sm:py-8 ${
                          length === id
                            ? "border-accent bg-surface text-foreground"
                            : "border-line bg-surface-2 hover:border-line hover:bg-surface-2"
                        }`}
                      >
                        <span className="text-[9px] font-bold uppercase tracking-wider tabular-nums text-ink-3 sm:text-[10px]">
                          {scenes} Scenes
                        </span>
                        <span className="mt-1 whitespace-nowrap text-lg font-extrabold tracking-tight transition-colors group-hover:text-accent-ink sm:text-xl">
                          {formatRunTime(id)}
                        </span>
                        <span
                          className={`mt-2.5 text-[11px] font-bold tracking-tight ${
                            length === id ? "text-accent-ink" : "text-muted"
                          }`}
                        >
                          GMD {LENGTH_PRICING_GMD[id].toLocaleString()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* DIRECT YOUR VISION */}
            {at("vision") && (
              <div className="flex flex-1 flex-col items-center justify-center gap-6 mx-auto w-full max-w-2xl">
                <h1 className="text-3xl sm:text-5xl font-black tracking-widest text-foreground uppercase text-center select-none drop-elevate-lg">
                  Direct Your Vision
                </h1>
                <p className="text-xs text-ink-3 text-center max-w-md -mt-3">
                  {isStory
                    ? "Tell us the story you want told — who it's about, what they want, what goes wrong. Our agents write it into a film."
                    : "Tell us about the ad you want — the brand, the feeling, the audience. Our agents turn it into a story."}
                </p>
                <div className="w-full rounded-[28px] border border-line bg-surface/80 backdrop-blur-xl p-4 elevate-lg transition-all duration-300 focus-within:border-accent-line focus-within:ring-2 focus-within:ring-accent-line">
                  <textarea
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    placeholder={
                      isStory
                        ? "A woman hides money from her own family, and the person she's hiding it for finds out first…"
                        : "Type a prompt..."
                    }
                    rows={5}
                    className="w-full bg-transparent resize-none outline-none text-sm placeholder:text-muted leading-relaxed text-foreground"
                  />
                  <div className="mt-2 border-t border-line pt-3 flex items-center justify-between">
                    <MicButton target="prompt" {...micProps} />
                    <span className="text-[10px] text-muted tabular-nums">
                      {chosenType.title} · {formatRunTime(length)} · {scenesForLength(length)} scenes
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* ORIENTATION */}
            {at("canvas") && (
              <div className="flex flex-1 flex-col items-center justify-center gap-6 mx-auto w-full max-w-2xl">
                <div className="text-center">
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">Pick your canvas</h1>
                  <p className="mt-1 text-xs text-muted">Where will this {isStory ? "film" : "ad"} live?</p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:gap-6 w-full">
                  {[
                    {
                      id: "16:9",
                      title: "Landscape",
                      sub: "16:9 — TV, YouTube, web",
                      icon: <Monitor size={16} className="text-accent-ink" />,
                      frame: <div className="h-[72px] w-32 sm:h-[90px] sm:w-40 rounded-xl border-2 border-current" />,
                    },
                    {
                      id: "9:16",
                      title: "Portrait",
                      sub: "9:16 — TikTok, Reels, Stories",
                      icon: <Smartphone size={16} className="text-accent-ink" />,
                      frame: <div className="h-32 w-[72px] sm:h-40 sm:w-[90px] rounded-xl border-2 border-current" />,
                    },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setAspectRatio(opt.id)}
                      className={`relative flex flex-col items-center gap-3 rounded-3xl border px-4 py-6 sm:py-8 transition-all duration-300 ${
                        aspectRatio === opt.id
                          ? "border-accent bg-surface text-foreground ring-2 ring-accent-line"
                          : "border-line bg-surface-2 text-muted hover:border-line hover:text-ink-2"
                      }`}
                    >
                      {aspectRatio === opt.id && (
                        <span className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white border border-line-2 shadow-md">
                          <Check size={11} />
                        </span>
                      )}
                      <div className="flex h-32 sm:h-40 items-center">{opt.frame}</div>
                      <div className="flex items-center gap-1.5 text-sm font-extrabold tracking-tight text-foreground">
                        {opt.icon} {opt.title}
                      </div>
                      <p className="text-[10px] text-muted -mt-2">{opt.sub}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* BRAND NAME — ads only; a story never reaches this step */}
            {at("brand") && (
              <div className="flex flex-1 flex-col items-center justify-center gap-6 mx-auto w-full max-w-xl">
                <div className="text-center">
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">What is your brand called?</h1>
                  <p className="mt-1 text-xs text-muted">Your brand or company name, exactly as it should appear.</p>
                </div>
                <div className="w-full rounded-[28px] border border-line bg-surface/80 backdrop-blur-xl p-4 elevate-lg transition-all duration-300 focus-within:border-accent-line focus-within:ring-2 focus-within:ring-accent-line">
                  <input
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    placeholder="e.g. Sidrah Salaam"
                    autoFocus
                    className="w-full bg-transparent outline-none text-lg sm:text-xl font-bold placeholder:text-faint placeholder:font-normal text-foreground text-center py-2"
                  />
                  <div className="mt-2 border-t border-line pt-3 flex justify-center">
                    <MicButton target="brand" {...micProps} />
                  </div>
                </div>
              </div>
            )}

            {/* PRODUCT / SERVICE — ads only */}
            {at("product") && (
              <div className="flex flex-1 flex-col items-center justify-center gap-6 mx-auto w-full max-w-xl">
                <div className="text-center">
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">What are you selling?</h1>
                  <p className="mt-1 text-xs text-muted">Your main product or service — the hero of the story.</p>
                </div>
                <div className="w-full rounded-[28px] border border-line bg-surface/80 backdrop-blur-xl p-4 elevate-lg transition-all duration-300 focus-within:border-accent-line focus-within:ring-2 focus-within:ring-accent-line">
                  <textarea
                    value={product}
                    onChange={(e) => setProduct(e.target.value)}
                    placeholder="e.g. Deygeh groundnut paste — 4.5kg tubs for families and restaurants"
                    rows={3}
                    autoFocus
                    className="w-full bg-transparent resize-none outline-none text-sm placeholder:text-muted leading-relaxed text-foreground"
                  />
                  <div className="mt-2 border-t border-line pt-3 flex justify-center">
                    <MicButton target="product" {...micProps} />
                  </div>
                </div>
              </div>
            )}

            {/* BRAND MATERIALS — ads only */}
            {at("materials") && (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 mx-auto w-full max-w-xl">
                <div className="text-center">
                  <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">Brand materials</h1>
                  <p className="mt-1.5 text-xs text-ink-3 max-w-md mx-auto">
                    <strong className="text-foreground">Upload your logo or images of your product.</strong> If you have none, that&apos;s fine — skip straight to generate.
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
                  className={`w-full rounded-3xl border border-dashed p-6 sm:p-8 text-center transition-all duration-300 ${
                    isDragging
                      ? "border-accent-line bg-surface-2 shadow-lg scale-[1.01]"
                      : "border-line bg-surface hover:border-line-2"
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
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-surface border border-line text-ink-3 mb-2">
                      <Upload size={15} />
                    </span>
                    <span className="text-sm font-bold text-foreground">Logo &amp; product images</span>
                    <span className="mt-1 text-[10px] text-muted">PNG, JPG or SVG — drag &amp; drop or tap to browse</span>
                  </label>
                </div>

                {brandMaterials.length > 0 && (
                  <div className="flex flex-wrap gap-2 justify-center max-h-[12dvh] overflow-y-auto">
                    {brandMaterials.map((file, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 rounded-full bg-success-soft border border-success px-3 py-1 text-[11px] font-semibold text-success"
                      >
                        <Paperclip size={10} />
                        <span className="max-w-[120px] truncate">{file.name}</span>
                        <button
                          type="button"
                          onClick={() => removeBrandMaterial(i)}
                          className="text-muted hover:text-danger font-bold ml-1 text-xs"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="w-full rounded-2xl border border-orange bg-orange-soft px-4 py-3 flex gap-2.5 items-start">
                  <AlertCircle size={14} className="shrink-0 mt-0.5 text-orange" />
                  <p className="text-[11px] leading-relaxed text-orange">
                    <strong className="text-orange">Please do not upload images of real people.</strong> Every person in your ad
                    is generated with AI — uploading someone&apos;s photo without consent violates our privacy policy. A person printed
                    on your own product&apos;s packaging is fine.
                  </p>
                </div>

              </div>
            )}

            {/* Generation errors used to live inside the brand-materials step,
                which is the last step of an AD. A story ends on the canvas step
                and would never have shown them, so the error surfaces on
                whichever screen actually carries the generate button. */}
            {error && isLastStep && (
              <div className="mx-auto w-full max-w-xl pb-4">
                <div className="w-full rounded-2xl border border-danger bg-danger-soft px-4 py-3 flex gap-2.5 text-xs text-danger items-start">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* ── BOTTOM NAV (in-flow, so every step is exactly one viewport) ── */}
      {!generating && (
        <footer className="relative z-10 shrink-0 px-4 pb-4 pt-2 flex justify-center">
          <div className="flex items-center gap-4 sm:gap-6 rounded-3xl border border-line bg-surface/85 backdrop-blur-xl px-4 sm:px-6 py-3 elevate-lg shadow-black/10 w-full max-w-xl justify-between">
            <button
              onClick={goBack}
              className="flex items-center gap-1.5 rounded-2xl bg-surface hover:bg-surface-2 px-4 py-2.5 text-xs font-semibold text-ink-2 transition-colors border border-line"
            >
              <ChevronLeft size={13} /> Back
            </button>

            <span className="text-[10px] tabular-nums text-muted uppercase tracking-widest hidden sm:block">
              Step {stepIndex + 1} / {steps.length}
            </span>

            {/* The first step's call to action is the "Create new project" card
                itself, so no duplicate Continue button competes with it. */}
            {at("projects") ? (
              <span className="text-[10px] tabular-nums text-faint uppercase tracking-widest">
                Pick up where you left off
              </span>
            ) : !isLastStep ? (
              <button
                disabled={!canContinue}
                onClick={goNext}
                className={`flex items-center gap-1.5 rounded-2xl px-5 py-2.5 text-xs font-bold transition-all shadow-lg ${
                  canContinue
                    ? "bg-foreground hover:bg-surface-2 text-background cursor-pointer"
                    : "bg-surface border border-line text-faint cursor-not-allowed opacity-50 shadow-none"
                }`}
              >
                Continue <ChevronRight size={13} />
              </button>
            ) : (
              <button
                onClick={() => setStoryboardPayOpen(true)}
                className="flex items-center gap-1.5 rounded-2xl bg-foreground hover:bg-ink-2 px-5 py-2.5 text-xs font-bold text-background transition-all"
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
