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
    <div className="flex h-full flex-col bg-background text-foreground relative">
      {/* Toast Alert */}
      {errorToast && (
        <div className="absolute top-4 right-4 z-50 flex items-center gap-2.5 bg-danger-soft border border-danger px-4 py-3 rounded-2xl text-danger text-xs backdrop-blur-md shadow-lg animate-in slide-in-from-top duration-300">
          <AlertCircle size={15} className="text-danger shrink-0" />
          <span>{errorToast}</span>
        </div>
      )}

      {/* Main Grid Workspace */}
      <div className="flex flex-1 min-h-0 flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">

        {/* Settings — stacked above the stage on small screens */}
        <aside className="w-full lg:w-[320px] shrink-0 border-b lg:border-b-0 lg:border-r border-line bg-background flex flex-col min-h-0 lg:overflow-y-auto">
          <form onSubmit={handleGenerateAttempt} className="p-5 pt-20 flex flex-col gap-5">
            
            {/* Stage 1: Choose Style */}
            <div className="flex flex-col gap-2.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted">1. Select Avatar Style</label>
              <div className="grid grid-cols-1 gap-2">
                {AVATAR_STYLES.map((style) => {
                  const Icon = style.icon;
                  const active = selectedStyle === style.id;
                  return (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => setSelectedStyle(style.id)}
                      className={`flex items-start gap-3 rounded-2xl border p-3 text-left transition-all ${
                        active
                          ? "bg-surface-2 border-line-2 text-foreground"
                          : "bg-surface border-line text-ink-3 hover:border-line hover:text-foreground"
                      }`}
                    >
                      <div className={`mt-0.5 rounded-xl p-1.5 ${active ? "bg-surface-2 text-foreground" : "bg-surface text-muted"}`}>
                        <Icon size={14} />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[11px] font-medium">{style.label}</span>
                        <span className="text-[9px] text-muted leading-normal">{style.desc}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Stage 2: Presenter Prompt */}
            <div className="flex flex-col gap-2.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted">2. Define Actor Appearance</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe your presenter's features, clothing, expressions, and posture... e.g., 'A professional corporate presenter with friendly features, wearing a sleek navy blazer, seated in a high-tech studio office, warm bokeh lighting...'"
                rows={4}
                className="w-full rounded-2xl border border-line bg-surface p-3 text-[11px] text-foreground placeholder-faint focus:border-line-2 focus:outline-none focus:ring-1 focus:ring-line transition-all leading-normal resize-none"
              />
            </div>

            {/* Stage 3: Drive Voice */}
            <div className="flex flex-col gap-2.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted">3. Driving Audio & Voice</label>
              
              <div className="flex flex-col gap-2">
                {VOICES.map((voice) => {
                  const active = selectedVoice === voice.id;
                  return (
                    <button
                      key={voice.id}
                      type="button"
                      onClick={() => setSelectedVoice(voice.id)}
                      className={`flex flex-col gap-0.5 rounded-2xl border p-3 text-left transition-all ${
                        active
                          ? "bg-surface-2 border-line-2 text-foreground"
                          : "bg-surface border-line text-ink-3 hover:border-line hover:text-foreground"
                      }`}
                    >
                      <span className="text-[11px] font-medium">{voice.label}</span>
                      <span className="text-[9px] text-muted leading-normal">{voice.desc}</span>
                    </button>
                  );
                })}
              </div>

              {selectedVoice === "Custom" && (
                <div className="mt-1 flex items-center justify-center border border-dashed border-line hover:border-line rounded-2xl p-4 bg-surface transition-all cursor-pointer" onClick={() => setShowUpgradeModal(true)}>
                  <div className="flex flex-col items-center gap-1.5 text-muted">
                    <Upload size={14} className="text-faint" />
                    <span className="text-[10px] font-medium">Upload audio reference (.wav, .mp3)</span>
                  </div>
                </div>
              )}
            </div>

            {/* Action Trigger Button */}
            <button
              type="submit"
              className="mt-2 flex h-10 w-full items-center justify-center gap-2 rounded-2xl bg-foreground hover:bg-ink-2 text-[12px] font-bold text-background shadow-md transition-all active:scale-[0.98]"
            >
              <Wand2 size={14} />
              Generate Avatar Video
            </button>
          </form>
        </aside>

        {/* Center Live Canvas Area */}
        <main className="flex-1 bg-background flex flex-col p-6 items-center justify-center relative">
          
          {/* Main Visual Dashboard Status Banner */}
          <div className="max-w-[620px] w-full bg-surface border border-line rounded-3xl p-6 md:p-8 flex flex-col gap-6 elevate-lg relative overflow-hidden backdrop-blur-md">
            
            {/* Visual glow accents */}
            <div className="absolute top-0 left-1/4 w-40 h-40 bg-surface-2 rounded-full blur-[60px]" />
            <div className="absolute bottom-0 right-1/4 w-40 h-40 bg-surface-2 rounded-full blur-[60px]" />

            {/* Top Row: Engine Architecture Status */}
            <div className="flex items-start justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-soft text-orange border border-orange">
                  <Wrench size={20} className="animate-pulse" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[12px] font-bold text-orange uppercase tracking-wider">Scheduled Engine Upgrade</span>
                  <span className="text-[14px] font-semibold text-foreground mt-0.5">Avatar Generation Paused</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-surface border border-line px-2.5 py-1 rounded-full text-[10px] text-ink-3 font-medium">
                <Hourglass size={11} className="text-orange shrink-0" />
                <span>Est. Completion: Mid-July 2026</span>
              </div>
            </div>

            {/* Premium, Intel-Rich Notification Details */}
            <div className="flex flex-col gap-4 relative z-10 text-ink-3 text-[11.5px] leading-relaxed border-t border-b border-line py-5 my-1">
              <p>
                Optiq Studio is currently migrating its core real-time neural avatar presenter and high-fidelity lipsync pipelines to a brand-new next-generation model architecture. 
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-1.5">
                <div className="bg-surface border border-line rounded-2xl p-3 flex gap-2.5 items-start">
                  <Cpu size={14} className="text-ink-3 mt-0.5 shrink-0" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-bold text-foreground">Next-Gen Audio-to-Lip Models</span>
                    <span className="text-[10px] text-muted">Integrating state-of-the-art MuseTalk and LatentSync pipelines for flawless phoneme alignment.</span>
                  </div>
                </div>
                <div className="bg-surface border border-line rounded-2xl p-3 flex gap-2.5 items-start">
                  <Zap size={14} className="text-ink-2 mt-0.5 shrink-0" />
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-bold text-foreground">Zero-Latency Neural Rendering</span>
                    <span className="text-[10px] text-muted">Calibrating our distributed cloud GPU nodes to achieve high-fidelity rendering outputs in sub-seconds.</span>
                  </div>
                </div>
              </div>

              <p className="mt-1 text-[10.5px] text-muted italic">
                Note: During this migration window, avatar creation and script-driven animations are paused. All existing assets, voices, and billing credits remain unaffected and secure.
              </p>
            </div>

            {/* Bottom Row: Interaction Callbacks */}
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-2 text-[10px] text-muted">
                <ShieldCheck size={12} className="text-success" />
                <span>All core system credits are fully secured.</span>
              </div>
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="text-[11px] font-bold text-foreground hover:text-foreground underline decoration-neutral-500 underline-offset-2 transition-colors flex items-center gap-1"
              >
                Read Upgrade Whitepaper →
              </button>
            </div>

          </div>

        </main>
      </div>

      {/* Full Premium Upgrade Overlay Modal */}
      {showUpgradeModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-foreground/25 backdrop-blur-md p-4 animate-fade-in">
          <div className="max-w-[500px] w-full bg-surface border border-line rounded-3xl p-6 flex flex-col gap-5 elevate-lg relative animate-scale-up">
            
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className="text-orange shrink-0" size={16} />
                <span className="text-[11px] font-bold uppercase tracking-wider text-orange">Technical Briefing</span>
              </div>
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="text-muted hover:text-foreground transition-colors text-[11px] font-medium"
              >
                Close (ESC)
              </button>
            </div>

            {/* Title */}
            <div className="flex flex-col gap-1 border-b border-line pb-4">
              <h3 className="text-[16px] font-bold text-foreground">Service Temporarily Unavailable</h3>
              <p className="text-[11px] text-muted">Optiq Avatar Engine Migration & calibration (v2.4.0)</p>
            </div>

            {/* Detailed Body */}
            <div className="flex flex-col gap-3.5 text-ink-3 text-[11px] leading-relaxed">
              <p>
                We are performing an architecturally complex infrastructure upgrade on our real-time video presenter model. Our engineers are deploying specialized deep-learning nodes configured specifically for high-temporal-consistency lip-syncing.
              </p>
              
              <div className="bg-surface border border-line rounded-2xl p-3.5 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-ink-3">DEPLOYMENT METRICS</span>
                  <span className="rounded-full bg-surface-2 border border-line-2 px-2 py-0.5 text-[8px] font-bold text-ink-2 uppercase">
                    Stage 3/4 (Validating)
                  </span>
                </div>
                <div className="w-full bg-background h-1.5 rounded-full overflow-hidden mt-1 border border-line">
                  <div className="bg-surface-3 h-full w-[78%] rounded-full" />
                </div>
                <div className="grid grid-cols-3 gap-2 mt-1.5 text-[9px] text-muted text-center">
                  <div className="flex flex-col bg-surface p-1.5 rounded-xl border border-line">
                    <span className="font-bold text-ink-2">A100 Nodes</span>
                    <span>Active & Syncing</span>
                  </div>
                  <div className="flex flex-col bg-surface p-1.5 rounded-xl border border-line">
                    <span className="font-bold text-ink-2">MuseTalk API</span>
                    <span>Latency Match</span>
                  </div>
                  <div className="flex flex-col bg-surface p-1.5 rounded-xl border border-line">
                    <span className="font-bold text-ink-2">RT-Rendering</span>
                    <span>Calibrating</span>
                  </div>
                </div>
              </div>

              <p>
                To provide a fully integrated ecosystem, we are taking extra care in syncing our custom voice clone libraries with face kinematics. This prevents the unnatural "rubbery lip" effect common in previous systems.
              </p>
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 border-t border-line pt-4 mt-1">
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="h-8 rounded-xl bg-surface border border-line px-4 text-[11px] font-semibold text-ink-2 hover:bg-surface-2 transition-colors"
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
