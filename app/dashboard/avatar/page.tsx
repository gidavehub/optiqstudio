"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import {
  Download,
  ImagePlus,
  Loader2,
  Mic,
  Sparkles,
  UploadCloud,
  UserSquare,
  Volume2,
  X,
  Zap,
} from "lucide-react";
import { useAuth } from "../../../components/AuthProvider";
import ConfirmGenerationModal from "../../../components/ConfirmGenerationModal";
import { db } from "../../../lib/firebase";

const PUBLIC_BUCKET_URL = "https://storage.googleapis.com/davelabs-tools";

type Backend = "musetalk" | "latentsync";

const BACKENDS: { id: Backend; name: string; blurb: string; perSec: number; icon: any }[] = [
  { id: "musetalk", name: "Fast", blurb: "Near real-time · great for long scripts", perSec: 20, icon: Zap },
  { id: "latentsync", name: "Best quality", blurb: "Diffusion · slower, most realistic", perSec: 60, icon: Sparkles },
];

// Mirrors lib/credits.ts avatarCost().
const ttsCost = (t: string) => Math.max(15, Math.ceil(t.length / 100) * 10);
const avatarSeconds = (t: string) => Math.max(1, Math.ceil(t.length / 15));
const avatarCost = (t: string, b: Backend) =>
  ttsCost(t) + (BACKENDS.find((x) => x.id === b)!.perSec) * avatarSeconds(t);

interface Upload {
  base64: string;
  mimeType: string;
  preview: string;
}

function fileToUpload(file: File): Promise<Upload> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      resolve({ base64: dataUrl.split(",")[1], mimeType: file.type, preview: dataUrl });
    };
    reader.readAsDataURL(file);
  });
}

export default function AvatarPage() {
  const { apiFetch, profile } = useAuth();

  const [face, setFace] = useState<Upload | null>(null);
  const [voice, setVoice] = useState<Upload | null>(null);
  const [voiceName, setVoiceName] = useState<string>("");
  const [text, setText] = useState("");
  const [backend, setBackend] = useState<Backend>("musetalk");

  // Drag and drop states and counters
  const [isDraggingFace, setIsDraggingFace] = useState(false);
  const dragCounterFace = useRef(0);

  const [isDraggingVoice, setIsDraggingVoice] = useState(false);
  const dragCounterVoice = useRef(0);

  const handleDragEnterFace = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterFace.current++;
    if (dragCounterFace.current === 1) {
      setIsDraggingFace(true);
    }
  };

  const handleDragLeaveFace = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterFace.current--;
    if (dragCounterFace.current === 0) {
      setIsDraggingFace(false);
    }
  };

  const handleDragOverFace = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropFace = async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterFace.current = 0;
    setIsDraggingFace(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      setFace(await fileToUpload(file));
    }
  };

  const handleDragEnterVoice = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterVoice.current++;
    if (dragCounterVoice.current === 1) {
      setIsDraggingVoice(true);
    }
  };

  const handleDragLeaveVoice = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterVoice.current--;
    if (dragCounterVoice.current === 0) {
      setIsDraggingVoice(false);
    }
  };

  const handleDragOverVoice = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropVoice = async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterVoice.current = 0;
    setIsDraggingVoice(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("audio/")) {
      setVoice(await fileToUpload(file));
      setVoiceName(file.name);
    }
  };

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const unsubRef = useRef<() => void>(() => {});

  const cost = avatarCost(text || " ", backend);
  const busy = status === "queued" || status === "running";

  // Realtime job status straight from Firestore — no polling.
  useEffect(() => {
    if (!jobId) return;
    unsubRef.current?.();
    const unsub = onSnapshot(doc(db, "generations", jobId), (snap) => {
      const d = snap.data();
      if (!d) return;
      setStatus(d.status);
      setProgress(typeof d.progress === "number" ? d.progress : 0);
      if (d.status === "succeeded") {
        setVideoUrl(`${PUBLIC_BUCKET_URL}/${d.outputPath}`);
      } else if (d.status === "failed") {
        setError(d.error || "Render failed");
      }
    });
    unsubRef.current = unsub;
    return () => unsub();
  }, [jobId]);

  useEffect(() => () => unsubRef.current?.(), []);

  const start = useCallback(async () => {
    if (!face || !voice || !text.trim()) return;
    setError(null);
    setVideoUrl(null);
    setProgress(0);
    setStatus("queued");
    try {
      const res = await apiFetch<{ id: string }>("/api/avatar/generate", {
        method: "POST",
        body: JSON.stringify({
          text: text.trim(),
          backend,
          faceBase64: face.base64,
          faceMimeType: face.mimeType,
          voiceBase64: voice.base64,
          voiceMimeType: voice.mimeType,
        }),
      });
      setJobId(res.id);
    } catch (e) {
      setStatus("failed");
      setError(e instanceof Error ? e.message : "Failed to start render");
    }
  }, [apiFetch, face, voice, text, backend]);

  const canGenerate = !!face && !!voice && !!text.trim() && !busy;

  return (
    <div className="flex h-full flex-col bg-black text-white lg:flex-row">
      {/* Config rail */}
      <aside className="w-full shrink-0 space-y-6 overflow-y-auto border-b border-neutral-900 bg-[#070707] p-5 lg:w-80 lg:border-b-0 lg:border-r">
        <div className="flex items-center gap-2 border-b border-neutral-900 pb-2">
          <UserSquare size={15} className="text-neutral-400" />
          <span className="font-mono text-xs font-bold uppercase tracking-widest text-neutral-400">
            Avatar Studio
          </span>
        </div>

        {/* Face */}
        <div 
          className="relative rounded-xl transition-all duration-300"
          onDragEnter={handleDragEnterFace}
          onDragOver={handleDragOverFace}
          onDragLeave={handleDragLeaveFace}
          onDrop={handleDropFace}
        >
          <p className="eyebrow mb-2">Face image</p>
          {face ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={face.preview} alt="Face" className="h-16 w-16 rounded-lg border border-neutral-800 object-cover" />
              <button onClick={() => setFace(null)} className="text-neutral-500 hover:text-white cursor-pointer">
                <X size={16} />
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-neutral-800 bg-[#0d0d0e] px-3 py-3 text-xs text-neutral-400 hover:border-neutral-700 transition-colors">
              <ImagePlus size={16} /> Upload a frontal portrait
              <input type="file" accept="image/*" className="hidden"
                onChange={async (e) => { const f = e.target.files?.[0]; if (f) setFace(await fileToUpload(f)); }} />
            </label>
          )}

          {/* Gorgeous Drop Overlay for Face */}
          {isDraggingFace && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-xl border border-dashed border-white/40 bg-black/85 backdrop-blur-sm pointer-events-none transition-all duration-300">
              <UploadCloud size={20} className="text-white animate-pulse animate-bounce-subtle" />
              <span className="text-[10px] font-mono tracking-widest text-white mt-1 uppercase">Drop Portrait</span>
            </div>
          )}
        </div>

        {/* Voice */}
        <div 
          className="relative rounded-xl transition-all duration-300"
          onDragEnter={handleDragEnterVoice}
          onDragOver={handleDragOverVoice}
          onDragLeave={handleDragLeaveVoice}
          onDrop={handleDropVoice}
        >
          <p className="eyebrow mb-2">Voice sample (6–15s)</p>
          {voice ? (
            <div className="flex items-center gap-3 rounded-lg border border-neutral-800 bg-[#0d0d0e] px-3 py-2.5">
              <Volume2 size={15} className="text-neutral-300" />
              <span className="flex-1 truncate text-xs text-neutral-300">{voiceName || "voice sample"}</span>
              <button onClick={() => { setVoice(null); setVoiceName(""); }} className="text-neutral-500 hover:text-white cursor-pointer">
                <X size={14} />
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-neutral-800 bg-[#0d0d0e] px-3 py-3 text-xs text-neutral-400 hover:border-neutral-700 transition-colors">
              <Mic size={16} /> Upload a voice clip to clone
              <input type="file" accept="audio/*" className="hidden"
                onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setVoice(await fileToUpload(f)); setVoiceName(f.name); } }} />
            </label>
          )}

          {/* Gorgeous Drop Overlay for Voice */}
          {isDraggingVoice && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-xl border border-dashed border-white/40 bg-black/85 backdrop-blur-sm pointer-events-none transition-all duration-300">
              <UploadCloud size={20} className="text-white animate-pulse animate-bounce-subtle" />
              <span className="text-[10px] font-mono tracking-widest text-white mt-1 uppercase">Drop Audio</span>
            </div>
          )}
        </div>

        {/* Backend */}
        <div>
          <p className="eyebrow mb-2">Quality</p>
          <div className="grid gap-2">
            {BACKENDS.map((b) => {
              const Icon = b.icon;
              const active = backend === b.id;
              return (
                <button key={b.id} onClick={() => setBackend(b.id)}
                  className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    active ? "border-neutral-700 bg-[#18181b]" : "border-neutral-800 bg-[#0d0d0e] hover:border-neutral-700"
                  }`}>
                  <Icon size={15} className="mt-0.5 text-neutral-300" />
                  <div>
                    <p className="text-sm font-medium text-white">{b.name}</p>
                    <p className="text-[11px] text-neutral-400">{b.blurb}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-neutral-500">{b.perSec} cr / sec</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-auto flex justify-between rounded-lg border border-neutral-900 bg-[#0d0d0e]/50 px-3 py-2 font-mono text-[10px] text-neutral-400">
          <span>Est. cost: <strong className="text-white">{text.trim() ? cost : 0} cr</strong></span>
          <span>Balance: <strong className="text-neutral-200">{profile ? profile.credits.toLocaleString() : "—"}</strong></span>
        </div>
      </aside>

      {/* Stage */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="mb-6 border-b border-neutral-900 pb-4">
            <span className="block font-mono text-[10px] font-bold uppercase tracking-widest text-neutral-500">Talking Avatar</span>
            <h2 className="mt-1 text-[18px] font-bold tracking-tight">Clone a voice, animate a face</h2>
          </div>

          <div className="mx-auto flex max-w-2xl flex-col items-center">
            {videoUrl ? (
              <div className="w-full space-y-4">
                <video src={videoUrl} controls autoPlay className="w-full rounded-2xl border border-neutral-800 bg-black" />
                <a href={videoUrl} download className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-black hover:bg-neutral-200">
                  <Download size={13} /> Download MP4
                </a>
              </div>
            ) : busy ? (
              <div className="flex aspect-video w-full flex-col items-center justify-center rounded-2xl border border-neutral-800 bg-[#070708] text-center">
                <Loader2 size={30} className="mb-4 animate-spin text-white" />
                <span className="font-mono text-sm font-semibold uppercase tracking-wide text-white">
                  {progress < 0.4 ? "Cloning voice…" : "Rendering lip sync…"}
                </span>
                <div className="mt-4 h-1 w-56 overflow-hidden rounded bg-white/10">
                  <div className="h-full bg-white transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
                <p className="mt-3 max-w-sm text-xs text-neutral-500">
                  {backend === "latentsync"
                    ? "Diffusion renders take a few minutes; longer clips take proportionally longer."
                    : "This usually takes a minute or two."}
                </p>
              </div>
            ) : (
              <div className="flex aspect-video w-full flex-col items-center justify-center rounded-2xl border border-dashed border-neutral-800 bg-[#070708] text-center text-neutral-600">
                <UserSquare size={34} className="mb-3 text-neutral-700" />
                <p className="text-sm text-neutral-400">Your avatar video will appear here</p>
                <p className="mt-1 max-w-xs text-xs text-neutral-600">Add a face, a voice sample, and a script, then generate.</p>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mx-8 mb-4 flex items-center justify-between rounded-xl border border-red-950 bg-red-950/40 p-4 text-xs text-red-300">
            <span>Error: {error}</span>
            <button onClick={() => setError(null)} className="text-neutral-500 hover:text-white"><X size={14} /></button>
          </div>
        )}

        {/* Script console */}
        <div className="border-t border-neutral-900 bg-[#070707]/90 p-5 backdrop-blur">
          <div className="flex items-end gap-3 rounded-2xl border border-neutral-800 bg-[#0a0a0c] p-3 shadow-inner">
            <textarea
              rows={1}
              value={text}
              onChange={(e) => { setText(e.target.value); e.target.style.height = "auto"; e.target.style.height = `${e.target.scrollHeight}px`; }}
              placeholder="Type what the avatar should say…"
              className="max-h-40 flex-1 resize-none bg-transparent py-1 text-sm placeholder:text-neutral-600 focus:outline-none"
            />
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={!canGenerate}
              className="shrink-0 rounded-full bg-white px-5 py-2 text-sm font-medium text-black transition-colors hover:bg-neutral-200 disabled:opacity-40"
            >
              {busy ? "Generating…" : "Generate"}
            </button>
          </div>
          {!face || !voice ? (
            <p className="mt-2 text-[11px] text-neutral-600">Add a face image and a voice sample in the left panel to enable generation.</p>
          ) : null}
        </div>
      </main>

      <ConfirmGenerationModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => { setConfirmOpen(false); void start(); }}
        cost={cost}
        balance={profile?.credits ?? 0}
        title="Confirm Avatar Generation"
        description={`This ${backend === "latentsync" ? "best-quality" : "fast"} render will deduct ${cost} credits from your balance.`}
        actionLabel="Generate Avatar"
      />
    </div>
  );
}
