"use client";

import React from "react";
import {
  Clapperboard, X, Mic, MicOff, Upload, Play, RefreshCw,
  ChevronRight, ChevronLeft, ChevronDown, Check, Paperclip, AlertCircle, Zap,
} from "lucide-react";
import { useEditorFlow } from "../_flow/EditorFlowProvider";
import { STORYBOARD_TEMPLATES } from "../_flow/types";
import StoryboardPaywallModal from "./StoryboardPaywallModal";

export default function StoryboardWizard() {
  const {
    goHome,
    wizardStep, setWizardStep,
    generating,
    length, setLength,
    projects, projectsLoading, openProject, deleteProject,
    promptText, setPromptText,
    promptExpanded, setPromptExpanded,
    recording, startSpeechRecognition, stopSpeechRecognition,
    aspectRatio, setAspectRatio,
    aspectDropdownOpen, setAspectDropdownOpen,
    selectedTemplateIdx, setSelectedTemplateIdx,
    setBrandName, setProduct, setHasCharacter, setCharacterName, setCharacterDesc,
    brandName, product, hasCharacter, characterName, characterDesc,
    brandMaterials, isDragging, setIsDragging, handleDrop, handleMaterialsUpload, removeBrandMaterial,
    error, setStoryboardPayOpen,
  } = useEditorFlow();

  return (
    <div className="flex h-full flex-col bg-background text-neutral-200">
      <div className="flex flex-1 flex-col overflow-y-auto relative w-full bg-transparent">
        {/* Symmetrical Fixed Cinematic Background Layer */}
        {wizardStep === 2 && (
          <div className="fixed inset-0 z-0 pointer-events-none w-full h-full">
            <div
              className="w-full h-full bg-cover bg-center bg-no-repeat"
              style={{ backgroundImage: "url('/media/storyboard_cinematic_bg.png')" }}
            />
            <div className="absolute inset-0 bg-[#0a0f1d]/75 backdrop-blur-[2px]" />
          </div>
        )}

        <div className={`relative z-10 flex flex-col flex-1 px-6 pb-32 mx-auto w-full ${wizardStep === 2 ? "pt-24 max-w-5xl" : "pt-20 max-w-3xl"}`}>
          {/* Back button */}
          <button
            onClick={goHome}
            className="self-start flex items-center gap-1.5 text-xs text-neutral-500 hover:text-white transition-colors"
          >
            <ChevronLeft size={14} /> Back to Portal
          </button>

          {/* Stepper Progress bar */}
          <div className="mt-6 flex items-center justify-between border-b border-white/5 pb-4">
            <h2 className="text-lg font-bold text-white tracking-tight">Storyboard Configuration</h2>
            <div className="flex gap-1.5">
              {[1, 2, 3].map((s) => (
                <span
                  key={s}
                  className={`h-1.5 w-8 rounded-full transition-all duration-300 ${
                    wizardStep === s ? "bg-white w-12" : "bg-[#131d35]"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Loading Screen Overlay */}
          {generating && (
            <div className="flex flex-1 flex-col items-center justify-center py-24 text-center">
              <RefreshCw size={36} className="text-white animate-spin" />
              <h3 className="mt-5 text-lg font-semibold text-white">Generating Storyboard Spec</h3>
              <p className="mt-2 text-xs text-neutral-500 max-w-md leading-relaxed">
                Our Gemini AI director is compiling your visual style contract, mapping out consecutive moments, and formatting copy-ready prompt blocks...
              </p>
            </div>
          )}

          {!generating && (
            <div className="mt-6 flex flex-1 flex-col">
              {/* STEP 1: LENGTH SELECTION */}
              {wizardStep === 1 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-sm font-bold text-white">Select Video Run-Time</h3>
                    <p className="text-xs text-neutral-500">
                      Determine campaign duration. Every scene compiles into precisely 10 seconds of video.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {[
                      { id: "30s", title: "30 Seconds", subtitle: "3 Scenes", desc: "Sleek, rapid ad block" },
                      { id: "60s", title: "60 Seconds", subtitle: "6 Scenes", desc: "Standard campaign flow" },
                      { id: "90s", title: "90 Seconds", subtitle: "9 Scenes", desc: "Longform narrative spec" },
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setLength(item.id as any)}
                        className={`group flex flex-col rounded-2xl border p-6 text-left transition-all duration-300 ${
                          length === item.id
                            ? "border-blue-500 bg-[#0c152d] text-white"
                            : "border-white/5 bg-surface-2 hover:border-white/10 hover:bg-[#131d35]"
                        }`}
                      >
                        <span className="text-[10px] font-bold text-neutral-400 tracking-wider uppercase">{item.subtitle}</span>
                        <span className="mt-1.5 text-base font-extrabold tracking-tight group-hover:text-blue-400 transition-colors">
                          {item.title}
                        </span>
                        <p className="mt-2 text-xs text-neutral-400 leading-normal">{item.desc}</p>
                      </button>
                    ))}
                  </div>

                  {/* PAST PROJECTS SECTION (SCROLLABLE & FIRESTORE INTEGRATED) */}
                  <div className="pt-8 border-t border-white/5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-neutral-500 animate-pulse" />
                          Past Storyboard Projects
                        </h4>
                        <p className="text-[10px] text-neutral-500 mt-0.5">
                          Access or resume work on your previously generated campaign specs.
                        </p>
                      </div>
                    </div>

                    {projectsLoading ? (
                      <div className="flex items-center gap-2 py-8 justify-center text-xs text-neutral-500 font-mono uppercase tracking-wider">
                        <RefreshCw size={12} className="animate-spin" /> Loading Projects...
                      </div>
                    ) : projects.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-white/5 bg-[#0c152d]/20 py-8 px-4 text-center">
                        <Clapperboard size={20} className="text-neutral-600 mx-auto mb-2" />
                        <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-mono">No past projects found</p>
                        <p className="text-[10px] text-neutral-600 mt-1 max-w-xs mx-auto">
                          Configure a new campaign run-time above and describe your film concept to start.
                        </p>
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-3 max-h-[340px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent">
                        {projects.map((proj) => {
                          const clipUrl =
                            proj.compileVideoUrl ||
                            (Object.values(proj.videoStatus || {}) as any[])
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
                                <video
                                  src={clipUrl}
                                  autoPlay
                                  loop
                                  muted
                                  playsInline
                                  preload="metadata"
                                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                                />
                              ) : (
                                <div className="media-fallback absolute inset-0 flex items-center justify-center">
                                  <Clapperboard size={18} className="text-neutral-600" />
                                </div>
                              )}

                              {/* Hover blur overlay — minimal text, video-studio style */}
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

              {/* STEP 2: CAMPAIGN PROMPT & VOICE */}
              {wizardStep === 2 && (
                <div className="space-y-8 select-none">
                  {/* Centralized Cinematic Leonardo AI Style Header */}
                  <div className="flex flex-col items-center text-center py-6 select-none">
                    <h1 className="text-4xl md:text-5xl font-black tracking-widest text-white uppercase select-none drop-shadow-2xl">
                      DIRECT YOUR VISION
                    </h1>
                  </div>

                  {/* Centralized Capsule/Pill Prompt Container */}
                  <div className="max-w-2xl mx-auto w-full space-y-4 relative z-20">
                    <div className="relative rounded-3xl border border-white/10 bg-[#0e1630]/75 backdrop-blur-xl p-4 transition-all duration-300 shadow-2xl focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/10">
                      <div className="flex items-start gap-3">
                        <div className={`transition-all duration-500 ease-in-out overflow-hidden w-full ${promptExpanded ? "h-28" : "h-10"}`}>
                          <textarea
                            value={promptText}
                            onFocus={() => setPromptExpanded(true)}
                            onChange={(e) => setPromptText(e.target.value)}
                            placeholder="Type a prompt..."
                            className="w-full h-full bg-transparent resize-none outline-none text-sm placeholder:text-neutral-500 leading-relaxed text-white pt-1"
                          />
                        </div>
                      </div>

                      {promptExpanded && (
                        <>
                          <div className="my-3 border-t border-white/5" />
                          <div className="flex items-center justify-between gap-3 pt-1">
                            <div className="flex items-center gap-2">
                              {recording ? (
                                <button
                                  type="button"
                                  onClick={stopSpeechRecognition}
                                  className="flex items-center gap-1 bg-red-600/20 border border-red-500/20 rounded-xl px-2.5 py-1.5 text-[10px] font-bold text-red-400 animate-pulse transition-all"
                                >
                                  <MicOff size={10} /> Stop
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={startSpeechRecognition}
                                  className="flex items-center gap-1 bg-white/5 border border-white/5 hover:border-white/10 rounded-xl px-2.5 py-1.5 text-[10px] font-bold text-neutral-400 hover:text-white transition-all"
                                >
                                  <Mic size={10} className="text-blue-400" /> Voice
                                </button>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => setAspectDropdownOpen(!aspectDropdownOpen)}
                                  className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl border backdrop-blur-xl transition-all text-xs font-semibold shadow-xl active:scale-95 duration-200 ${
                                    aspectDropdownOpen
                                      ? "bg-surface border-blue-500 text-white"
                                      : "bg-surface/90 border-white/10 hover:border-blue-500/50 text-neutral-200"
                                  }`}
                                >
                                  <span className="text-[9px] font-extrabold tracking-wider font-mono text-neutral-400 uppercase">Aspect</span>
                                  <span className="text-[12px] font-semibold text-white">
                                    {aspectRatio === "16:9" ? "Landscape (16:9)" : "Portrait (9:16)"}
                                  </span>
                                  <ChevronDown size={12} className={`text-blue-400 transition-transform duration-300 ${aspectDropdownOpen ? "rotate-180 text-blue-400" : "text-neutral-400"}`} />
                                </button>

                                {aspectDropdownOpen && (
                                  <>
                                    <div className="fixed inset-0 z-40" onClick={() => setAspectDropdownOpen(false)} />
                                    <div className="absolute right-0 bottom-full mb-2 z-50 min-w-[160px] rounded-2xl border border-white/10 bg-surface/90 backdrop-blur-xl p-1.5 shadow-2xl animate-scaleUp origin-bottom-right">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setAspectRatio("16:9");
                                          setAspectDropdownOpen(false);
                                        }}
                                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors ${
                                          aspectRatio === "16:9" ? "bg-white/10 text-white" : "text-neutral-400 hover:text-white hover:bg-white/5"
                                        }`}
                                      >
                                        Landscape (16:9)
                                        {aspectRatio === "16:9" && <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setAspectRatio("9:16");
                                          setAspectDropdownOpen(false);
                                        }}
                                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors ${
                                          aspectRatio === "9:16" ? "bg-white/10 text-white" : "text-neutral-400 hover:text-white hover:bg-white/5"
                                        }`}
                                      >
                                        Portrait (9:16)
                                        {aspectRatio === "9:16" && <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />}
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* PRE-BUILT CAMPAIGN TEMPLATE EXAMPLES GRID */}
                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <span className="text-xs font-bold text-white uppercase tracking-widest block">
                      Select a Pre-Built Cinematic Vibe Template
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {STORYBOARD_TEMPLATES.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            if (selectedTemplateIdx === idx) {
                              setSelectedTemplateIdx(null);
                              setPromptText("");
                              setBrandName("");
                              setProduct("");
                              setHasCharacter(true);
                              setCharacterName("");
                              setCharacterDesc("");
                            } else {
                              setSelectedTemplateIdx(idx);
                              setPromptText(item.concept);
                              setBrandName(item.brandName);
                              setProduct(item.product);
                              setHasCharacter(item.hasCharacter);
                              setCharacterName(item.characterName);
                              setCharacterDesc(item.characterDesc);
                            }
                          }}
                          className={`group relative flex flex-col overflow-hidden rounded-2xl border p-4 text-left transition-all duration-300 ${
                            selectedTemplateIdx === idx
                              ? "border-white bg-[#0e1630]/50 shadow-xl ring-2 ring-white/20"
                              : selectedTemplateIdx !== null
                              ? "border-white/5 bg-surface opacity-40 hover:opacity-80 hover:border-white/10"
                              : "border-white/5 bg-surface hover:border-white/10 hover:shadow-2xl"
                          }`}
                        >
                          {selectedTemplateIdx === idx && (
                            <span className="absolute top-3 right-3 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-[#131d35] text-white border border-white/20 shadow-md">
                              <Check size={11} />
                            </span>
                          )}

                          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-[#0c152d] border border-white/5">
                            {item.coverVideo.endsWith(".mp4") ? (
                              <video
                                src={item.coverVideo}
                                autoPlay
                                loop
                                muted
                                playsInline
                                className="h-full w-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-[1.03] transition-all duration-700"
                              />
                            ) : (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={item.coverVideo}
                                alt={item.name}
                                className="h-full w-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-[1.03] transition-all duration-700"
                              />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-[#08080a]/95 via-transparent to-transparent" />
                            <span className="absolute bottom-3 left-3 text-[9px] font-bold tracking-widest text-white uppercase bg-white/20 border border-white/10 rounded px-2.5 py-1">
                              {item.subtitle}
                            </span>
                          </div>

                          <h4 className="mt-4 text-base font-extrabold text-white tracking-tight leading-tight">{item.name}</h4>
                          <p className="mt-2 text-xs text-neutral-400 leading-relaxed line-clamp-3">{item.concept}</p>
                          <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap gap-2">
                            <span className="text-[10px] font-medium text-neutral-500 bg-white/5 rounded px-2 py-0.5">
                              Product: {item.product}
                            </span>
                            {item.hasCharacter && (
                              <span className="text-[10px] font-medium text-white/80 bg-white/5 border border-white/10 rounded px-2 py-0.5">
                                Character: {item.characterName}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: BRANDING & CHARACTER LOCK OPTION */}
              {wizardStep === 3 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-sm font-bold text-white">Brand Profile &amp; Subject Lock</h3>
                    <p className="text-xs text-neutral-500">
                      Configure your brand information and toggle recurring character parameters.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-400">Brand Name</label>
                        <input
                          value={brandName}
                          onChange={(e) => setBrandName(e.target.value)}
                          placeholder="e.g. DEX"
                          className="mt-1.5 w-full rounded-xl border border-white/5 bg-surface-2 px-4 py-2.5 text-xs text-white focus:border-white/10 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-400">Main Product/Service</label>
                        <input
                          value={product}
                          onChange={(e) => setProduct(e.target.value)}
                          placeholder="e.g. Groundnut Paste"
                          className="mt-1.5 w-full rounded-xl border border-white/5 bg-surface-2 px-4 py-2.5 text-xs text-white focus:border-white/10 outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-400 mb-1.5">Storytelling / Character Type</label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setHasCharacter(true)}
                            className={`flex-1 py-3 text-xs font-bold rounded-xl border transition-all duration-300 ${
                              hasCharacter
                                ? "border-blue-500 bg-[#0c152d] text-white"
                                : "border-white/5 bg-surface-2 hover:border-white/10 hover:bg-[#131d35] text-neutral-400"
                            }`}
                          >
                            Main Character Lock
                          </button>
                          <button
                            type="button"
                            onClick={() => setHasCharacter(false)}
                            className={`flex-1 py-3 text-xs font-bold rounded-xl border transition-all duration-300 ${
                              !hasCharacter
                                ? "border-blue-500 bg-[#0c152d] text-white"
                                : "border-white/5 bg-surface-2 hover:border-white/10 hover:bg-[#131d35] text-neutral-400"
                            }`}
                          >
                            Multiple People / Product Focus
                          </button>
                        </div>
                        <p className="mt-1.5 text-[10px] text-neutral-500 leading-normal">
                          {hasCharacter
                            ? "Locks a single recurring main character across all scenes for unified narrative focus."
                            : "Different scenes will feature different people and community members interacting around the product."}
                        </p>
                      </div>

                      {hasCharacter && (
                        <div className="grid grid-cols-1 gap-3.5 animate-fadeIn">
                          <div>
                            <label className="block text-[11px] font-semibold text-neutral-400">Subject Name</label>
                            <input
                              value={characterName}
                              onChange={(e) => setCharacterName(e.target.value)}
                              placeholder="e.g. Nyima"
                              className="mt-1 w-full rounded-xl border border-white/5 bg-surface-2 px-4 py-2 text-xs text-white focus:border-white/10 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-neutral-400">Physical Markers (LCB)</label>
                            <input
                              value={characterDesc}
                              onChange={(e) => setCharacterDesc(e.target.value)}
                              placeholder="e.g. Oval-faced Gambian woman, neat thin cornrow braids, 20s"
                              className="mt-1 w-full rounded-xl border border-white/5 bg-surface-2 px-4 py-2 text-xs text-white focus:border-white/10 outline-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Multi-material File Upload block */}
                  <div className="space-y-2">
                    <label className="block text-[11px] font-semibold text-neutral-400">Brand Materials &amp; Graphics</label>
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
                      className={`rounded-xl border border-dashed p-6 text-center transition-all duration-300 relative ${
                        isDragging
                          ? "border-white/20 bg-[#0e1630]/50 shadow-lg scale-[1.01]"
                          : "border-white/10 bg-surface hover:border-white/10"
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
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0e1630] border border-white/10 text-neutral-400 mb-2">
                          <Upload size={14} />
                        </span>
                        <span className="text-xs font-semibold text-white">Upload Brand Files / Logos</span>
                        <span className="mt-1 text-[10px] text-neutral-500">
                          Attach multiple reference graphics, fonts, or assets (PNG, JPG, SVG)
                        </span>
                      </label>
                    </div>

                    {brandMaterials.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2">
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
                  </div>

                  {error && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 flex gap-3 text-xs text-red-400 items-start">
                      <AlertCircle size={14} className="shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* FLOATING NAVIGATION BAR FOR WIZARD */}
      <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4 animate-slideUp">
        <div className="flex items-center gap-6 rounded-2xl border border-white/5 bg-surface/85 backdrop-blur-xl px-6 py-3.5 shadow-2xl shadow-black/95 w-full max-w-xl justify-between">
          <button
            onClick={() => {
              if (wizardStep === 1) {
                goHome();
              } else if (wizardStep === 2) {
                setWizardStep(1);
                setSelectedTemplateIdx(null);
              } else if (wizardStep === 3) {
                setWizardStep(2);
              }
            }}
            className="flex items-center gap-1.5 rounded-xl bg-white/5 hover:bg-white/10 px-4 py-2.5 text-xs font-semibold text-neutral-300 transition-colors border border-white/5"
          >
            <ChevronLeft size={13} /> Back
          </button>

          <div className="flex items-center gap-1.5">
            {[1, 2, 3].map((s) => (
              <span
                key={s}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  wizardStep === s ? "bg-white w-6" : "bg-[#131d35] w-1.5"
                }`}
              />
            ))}
          </div>

          {wizardStep === 1 && (
            <button
              onClick={() => setWizardStep(2)}
              className="flex items-center gap-1.5 rounded-xl bg-white hover:bg-neutral-200 px-5 py-2.5 text-xs font-bold text-black transition-all"
            >
              Continue <ChevronRight size={13} />
            </button>
          )}

          {wizardStep === 2 && (
            <button
              disabled={!promptText.trim() && selectedTemplateIdx === null}
              onClick={() => setWizardStep(3)}
              className={`flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-bold transition-all shadow-lg ${
                !promptText.trim() && selectedTemplateIdx === null
                  ? "bg-[#0e1630] border border-white/5 text-neutral-600 cursor-not-allowed opacity-50 shadow-none"
                  : "bg-white hover:bg-neutral-200 text-black cursor-pointer"
              }`}
            >
              Continue <ChevronRight size={13} />
            </button>
          )}

          {wizardStep === 3 && (
            <button
              disabled={generating}
              onClick={() => setStoryboardPayOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-white hover:bg-neutral-200 px-5.5 py-2.5 text-xs font-bold text-black transition-all"
            >
              {generating ? (
                <>
                  <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                  Generating...
                </>
              ) : (
                <>
                  <Zap size={13} /> Generate Spec
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <StoryboardPaywallModal />
    </div>
  );
}
