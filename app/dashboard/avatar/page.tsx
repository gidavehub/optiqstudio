"use client";

import React, { useState } from "react";
import {
  Wand2,
  UserSquare,
  Wrench,
  Cpu,
  Layers,
  Hourglass,
  Play,
  Upload,
  Volume2,
  Settings,
  HelpCircle,
  AlertCircle,
  ShieldCheck,
  Zap,
} from "lucide-react";

export default function AvatarStudioPage() {
  const [prompt, setPrompt] = useState("");
  const [selectedStyle, setSelectedStyle] = useState("cinematic");
  const [selectedVoice, setSelectedVoice] = useState("Kore");
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);

  const AVATAR_STYLES = [
    { id: "cinematic", label: "Hyper-Realistic Cinematic", desc: "Red-camera lighting, shallow depth of field", icon: Wand2 },
    { id: "anime", label: "Stylized Anime/3D", desc: "Cel-shaded, vibrant gradient grading", icon: Layers },
    { id: "presenter", label: "Corporate Presenter", desc: "Studio softbox lighting, clean professional backdrop", icon: UserSquare },
    { id: "cyberpunk", label: "Cyberpunk Host", desc: "Neonic grading, holographic visual accents", icon: Zap },
  ];

  const VOICES = [
    { id: "Kore", label: "Kore (Expressive Studio Male)", desc: "Warm, natural pacing, clear articulation" },
    { id: "Amina", label: "Amina (Premium Presenter Female)", desc: "Authoritative, professional, ideal for tutorials" },
    { id: "Custom", label: "Custom Cloned Voice", desc: "Use your own uploaded reference audio sample" },
  ];

  const handleGenerateAttempt = (e: React.FormEvent) => {
    e.preventDefault();
    setShowUpgradeModal(true);
    triggerToast("Generation paused: Neural rendering pipeline upgrade in progress.");
  };

  const triggerToast = (msg: string) => {
    setErrorToast(msg);
    setTimeout(() => {
      setErrorToast(null);
    }, 5000);
  };

  return (
    <div className="flex h-full flex-col bg-black text-white relative">
      {/* Toast Alert */}
      {errorToast && (
        <div className="absolute top-4 right-4 z-50 flex items-center gap-2.5 bg-red-950/80 border border-red-500/20 px-4 py-3 rounded-xl text-red-200 text-xs backdrop-blur-md shadow-lg animate-in slide-in-from-top duration-300">
          <AlertCircle size={15} className="text-red-400 shrink-0" />
          <span>{errorToast}</span>
        </div>
      )}

      {/* Main Grid Workspace */}
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">

        {/* Settings — stacked above the stage on small screens */}
        <aside className="w-full lg:w-[320px] shrink-0 border-b lg:border-b-0 lg:border-r border-white/5 bg-background flex flex-col min-h-0 lg:overflow-y-auto">
          <form onSubmit={handleGenerateAttempt} className="p-5 pt-20 flex flex-col gap-5">
            
            {/* Stage 1: Choose Style */}
            <div className="flex flex-col gap-2.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">1. Select Avatar Style</label>
              <div className="grid grid-cols-1 gap-2">
                {AVATAR_STYLES.map((style) => {
                  const Icon = style.icon;
                  const active = selectedStyle === style.id;
                  return (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setSelectedStyle(style.id)}
                      className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                        active
                          ? "bg-white/10 border-white/20 text-white"
                          : "bg-white/[0.02] border-white/5 text-neutral-400 hover:border-white/10 hover:text-white"
                      }`}
                    >
                      <div className={`mt-0.5 rounded-lg p-1.5 ${active ? "bg-white/10 text-neutral-200" : "bg-white/5 text-neutral-500"}`}>
                        <Icon size={14} />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] font-medium">{style.label}</span>
                        <span className="text-[9px] text-neutral-500 leading-normal">{style.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stage 2: Presenter Prompt */}
            <div className="flex flex-col gap-2.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">2. Define Actor Appearance</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your presenter's features, clothing, expressions, and posture... e.g., 'A professional corporate presenter with friendly features, wearing a sleek navy blazer, seated in a high-tech studio office, warm bokeh lighting...'"
                rows={4}
                className="w-full rounded-xl border border-white/5 bg-white/[0.02] p-3 text-[11px] text-white placeholder-neutral-600 focus:border-neutral-700 focus:outline-none focus:ring-1 focus:ring-neutral-800 transition-all leading-normal resize-none"
              />
            </div>

            {/* Stage 3: Drive Voice */}
            <div className="flex flex-col gap-2.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">3. Driving Audio & Voice</label>
              
              <div className="flex flex-col gap-2">
                {VOICES.map((voice) => {
                  const active = selectedVoice === voice.id;
                  return (
                    <button
                      key={voice.id}
                      type="button"
                      onClick={() => setSelectedVoice(voice.id)}
                      className={`flex flex-col gap-0.5 rounded-xl border p-3 text-left transition-all ${
                        active
                          ? "bg-white/10 border-white/20 text-white"
                          : "bg-white/[0.02] border-white/5 text-neutral-400 hover:border-white/10 hover:text-white"
                      }`}
                    >
                      <span className="text-[11px] font-medium">{voice.label}</span>
                      <span className="text-[9px] text-neutral-500 leading-normal">{voice.desc}</span>
                    </button>
                  );
                })}
              </div>

              {selectedVoice === "Custom" && (
                <div className="mt-1 flex items-center justify-center border border-dashed border-white/5 hover:border-white/10 rounded-xl p-4 bg-white/[0.01] transition-all cursor-pointer" onClick={() => setShowUpgradeModal(true)}>
                  <div className="flex flex-col items-center gap-1.5 text-neutral-500">
                    <Upload size={14} className="text-neutral-600" />
                    <span className="text-[10px] font-medium">Upload audio reference (.wav, .mp3)</span>
                  </div>
                </div>
              )}
            </div>

            {/* Action Trigger Button */}
            <button
              type="submit"
              className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white hover:bg-neutral-200 text-[12px] font-bold text-black shadow-md transition-all active:scale-[0.98]"
            >
              <Wand2 size={14} />
              Generate Avatar Video
            </button>
          </form>
        </aside>

        {/* Center Live Canvas Area */}
        <main className="flex-1 bg-black flex flex-col p-6 items-center justify-center relative">
          
          {/* Main Visual Dashboard Status Banner */}
          <div className="max-w-[620px] w-full bg-surface border border-white/5 rounded-2xl p-6 md:p-8 flex flex-col gap-6 shadow-2xl relative overflow-hidden backdrop-blur-md">
            
            {/* Visual glow accents */}
            <div className="absolute top-0 left-1/4 w-40 h-40 bg-neutral-600/5 rounded-full blur-[60px]" />
            <div className="absolute bottom-0 right-1/4 w-40 h-40 bg-neutral-500/5 rounded-full blur-[60px]" />

            {/* Top Row: Engine Architecture Status */}
            <div className="flex items-start justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <Wrench size={20} className="animate-pulse" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[12px] font-bold text-amber-400 uppercase tracking-wider">Scheduled Engine Upgrade</span>
                  <span className="text-[14px] font-semibold text-neutral-200 mt-0.5">Avatar Generation Paused</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-neutral-900 border border-white/5 px-2.5 py-1 rounded-full text-[10px] text-neutral-400 font-medium">
                <Hourglass size={11} className="text-amber-400 shrink-0" />
                <span>Est. Completion: Mid-July 2026</span>
              </div>
            </div>

            {/* Premium, Intel-Rich Notification Details */}
            <div className="flex flex-col gap-4 relative z-10 text-neutral-400 text-[11.5px] leading-relaxed border-t border-b border-white/5 py-5 my-1">
              <p>
                Optiq Studio is currently migrating its core real-time neural avatar presenter and high-fidelity lipsync pipelines to a brand-new next-generation model architecture. 
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-1.5">
                <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3 flex gap-2.5 items-start">
                  <Cpu size={14} className="text-neutral-400 mt-0.5 shrink-0" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-bold text-neutral-200">Next-Gen Audio-to-Lip Models</span>
                    <span className="text-[10px] text-neutral-500">Integrating state-of-the-art MuseTalk and LatentSync pipelines for flawless phoneme alignment.</span>
                  </div>
                </div>
                <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3 flex gap-2.5 items-start">
                  <Zap size={14} className="text-neutral-300 mt-0.5 shrink-0" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-bold text-neutral-200">Zero-Latency Neural Rendering</span>
                    <span className="text-[10px] text-neutral-500">Calibrating our distributed cloud GPU nodes to achieve high-fidelity rendering outputs in sub-seconds.</span>
                  </div>
                </div>
              </div>

              <p className="mt-1 text-[10.5px] text-neutral-500 italic">
                Note: During this migration window, avatar creation and script-driven animations are paused. All existing assets, voices, and billing credits remain unaffected and secure.
              </p>
            </div>

            {/* Bottom Row: Interaction Callbacks */}
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-2 text-[10px] text-neutral-500">
                <ShieldCheck size={12} className="text-emerald-500" />
                <span>All core system credits are fully secured.</span>
              </div>
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="text-[11px] font-bold text-neutral-200 hover:text-white underline decoration-neutral-500 underline-offset-2 transition-colors flex items-center gap-1"
              >
                Read Upgrade Whitepaper →
              </button>
            </div>

          </div>

        </main>
      </div>

      {/* Full Premium Upgrade Overlay Modal */}
      {showUpgradeModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in">
          <div className="max-w-[500px] w-full bg-surface border border-white/10 rounded-2xl p-6 flex flex-col gap-5 shadow-2xl relative animate-scale-up">
            
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className="text-amber-400 shrink-0" size={16} />
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">Technical Briefing</span>
              </div>
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="text-neutral-500 hover:text-white transition-colors text-[11px] font-medium"
              >
                Close (ESC)
              </button>
            </div>

            {/* Title */}
            <div className="flex flex-col gap-1 border-b border-white/5 pb-4">
              <h3 className="text-[16px] font-bold text-neutral-200">Service Temporarily Unavailable</h3>
              <p className="text-[11px] text-neutral-500">Optiq Avatar Engine Migration & calibration (v2.4.0)</p>
            </div>

            {/* Detailed Body */}
            <div className="flex flex-col gap-3.5 text-neutral-400 text-[11px] leading-relaxed">
              <p>
                We are performing an architecturally complex infrastructure upgrade on our real-time video presenter model. Our engineers are deploying specialized deep-learning nodes configured specifically for high-temporal-consistency lip-syncing.
              </p>
              
              <div className="bg-white/[0.01] border border-white/5 rounded-xl p-3.5 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-neutral-400">DEPLOYMENT METRICS</span>
                  <span className="rounded-full bg-neutral-800 border border-neutral-700 px-2 py-0.5 text-[8px] font-bold text-neutral-300 uppercase">
                    Stage 3/4 (Validating)
                  </span>
                </div>
                <div className="w-full bg-neutral-950 h-1.5 rounded-full overflow-hidden mt-1 border border-white/5">
                  <div className="bg-neutral-500 h-full w-[78%] rounded-full" />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-1.5 text-[9px] text-neutral-500 text-center">
                  <div className="flex flex-col bg-white/[0.01] p-1.5 rounded-lg border border-white/5">
                    <span className="font-bold text-neutral-300">A100 Nodes</span>
                    <span>Active & Syncing</span>
                  </div>
                  <div className="flex flex-col bg-white/[0.01] p-1.5 rounded-lg border border-white/5">
                    <span className="font-bold text-neutral-300">MuseTalk API</span>
                    <span>Latency Match</span>
                  </div>
                  <div className="flex flex-col bg-white/[0.01] p-1.5 rounded-lg border border-white/5">
                    <span className="font-bold text-neutral-300">RT-Rendering</span>
                    <span>Calibrating</span>
                  </div>
                </div>
              </div>

              <p>
                To provide a fully integrated ecosystem, we are taking extra care in syncing our custom voice clone libraries with face kinematics. This prevents the unnatural "rubbery lip" effect common in previous systems.
              </p>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 border-t border-white/5 pt-4 mt-1">
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="h-8 rounded-lg bg-neutral-900 border border-white/5 px-4 text-[11px] font-semibold text-neutral-300 hover:bg-neutral-800 transition-colors"
              >
                Acknowledge & Close
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
