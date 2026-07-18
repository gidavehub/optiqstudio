"use client";

// VideoDetailClient — /dashboard/video/[id]. Single-column redesign:
// player on top (download lives inside the player controls), the prompt card
// directly beneath (clamped + tap-to-expand + copy + reference images), and
// the Omni refinement console tucked below that.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, ImagePlus, Loader2, Mic, Trash2, Wand2, X,
} from "lucide-react";
import { useAuth } from "../../../../components/AuthProvider";
import ConfirmGenerationModal from "../../../../components/ConfirmGenerationModal";
import PromptCard from "../../_shared/PromptCard";
import { useReferenceImages } from "../../_shared/useReferenceImages";
import CustomVideoPlayer from "./CustomVideoPlayer";
import AudioPlayerPreview from "./AudioPlayerPreview";
import { AttachedAudio, AttachedImage, HistoryItem } from "./types";

const EDIT_COST = 100;

export default function VideoDetailClient({ id }: { id: string }) {
  const { apiFetch, profile, refreshProfile } = useAuth();
  const router = useRouter();

  const [item, setItem] = useState<HistoryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refinement console state
  const [prompt, setPrompt] = useState("");
  const [images, setImages] = useState<AttachedImage[]>([]);
  const [audioFile, setAudioFile] = useState<AttachedAudio | null>(null);
  const [enhancing, setEnhancing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const refUrls = useReferenceImages(item?.images);

  // ── Load + poll ────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    try {
      const d = await apiFetch<{ items: HistoryItem[] }>("/api/generations?type=video");
      const found = d.items.find((i) => i.id === id) ?? null;
      setItem(found);
      setLoading(false);
      return found;
    } catch {
      setLoading(false);
      return null;
    }
  }, [apiFetch, id]);

  useEffect(() => {
    void load();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [load]);

  const isRendering =
    !!item && (item.status === "rendering" || item.status === "generating" || item.status === "processing" || !item.videoUrl);

  useEffect(() => {
    if (!isRendering || pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const status = await apiFetch<{ status: string; videoUrl?: string }>(`/api/video/status?id=${id}`);
        if (status.status === "succeeded" || status.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          void refreshProfile();
          void load();
        }
      } catch {
        /* ignore */
      }
    }, 5000);
  }, [isRendering, apiFetch, id, load, refreshProfile]);

  // ── Actions ────────────────────────────────────────────────────────────
  const attachImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setImages((prev) => [
        ...prev,
        { id: Math.random().toString(36).slice(2, 9), base64: dataUrl.split(",")[1], mimeType: file.type, preview: dataUrl },
      ]);
    };
    reader.readAsDataURL(file);
  };

  const attachAudio = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setAudioFile({ base64: dataUrl.split(",")[1], mimeType: file.type, preview: dataUrl, name: file.name });
    };
    reader.readAsDataURL(file);
  };

  const enhance = async () => {
    if (!prompt.trim() || enhancing) return;
    setEnhancing(true);
    try {
      const data = await apiFetch<{ prompt: string }>("/api/enhance", {
        method: "POST",
        body: JSON.stringify({ prompt }),
      });
      setPrompt(data.prompt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enhance failed");
    } finally {
      setEnhancing(false);
    }
  };

  const runOmniEdit = async () => {
    if (!item || !prompt.trim() || editing) return;
    setEditing(true);
    setError(null);
    try {
      const start = await apiFetch<{ id: string }>("/api/video/generate", {
        method: "POST",
        body: JSON.stringify({
          prompt: `Modify video: ${prompt}. Context base: ${item.prompt}`,
          model: "omni",
          aspectRatio: "16:9",
          durationSeconds: 10,
          generateAudio: true,
          images: images.map((img) => ({ base64: img.base64, mimeType: img.mimeType })),
          imageBase64: images[0]?.base64 || undefined,
          imageMimeType: images[0]?.mimeType || undefined,
          audioBase64: audioFile?.base64,
          audioMimeType: audioFile?.mimeType,
        }),
      });
      void refreshProfile();
      router.push(`/dashboard/video/${start.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Edit failed");
      setEditing(false);
    }
  };

  const deleteItem = async () => {
    if (!item || !confirm("Permanently delete this video?")) return;
    try {
      await apiFetch(`/api/generations?id=${item.id}`, { method: "DELETE" });
    } catch {
      /* optimistic */
    }
    router.push("/dashboard/video");
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-y-auto bg-black text-white">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-6 pb-16 pt-20">
        {/* Back */}
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard/video"
            className="group flex w-fit items-center gap-1.5 text-[11px] font-bold font-mono uppercase tracking-wider text-neutral-500 hover:text-white transition-colors"
          >
            <ArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform" />
            Video Studio
          </Link>
          {item && (
            <button
              onClick={deleteItem}
              className="flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/5 px-3 py-1.5 text-[10px] font-semibold text-neutral-400 hover:border-red-500/30 hover:text-red-400 transition-colors"
            >
              <Trash2 size={11} /> Delete
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-neutral-500">
            <Loader2 size={24} className="animate-spin mb-3" />
            <span className="text-xs font-mono uppercase tracking-wider">Loading Project…</span>
          </div>
        ) : !item ? (
          <div className="rounded-2xl border border-white/5 bg-[#0c152d]/40 py-20 text-center">
            <p className="text-xs font-mono uppercase tracking-widest text-neutral-500">Video not found</p>
          </div>
        ) : (
          <>
            {/* 1 · PLAYER */}
            {isRendering ? (
              <div className="relative aspect-video overflow-hidden rounded-2xl border border-white/10 bg-[#070b16]">
                <div className="absolute -inset-[20px] opacity-40">
                  <div className="absolute top-1/4 left-1/4 h-40 w-40 rounded-full bg-blue-600/15 blur-3xl animate-pulse" style={{ animationDuration: "4s" }} />
                  <div className="absolute bottom-1/4 right-1/4 h-44 w-44 rounded-full bg-blue-500/20 blur-3xl animate-pulse" style={{ animationDuration: "6s" }} />
                </div>
                <div className="absolute inset-0 bg-black/40 backdrop-blur-2xl" />
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-8 text-center">
                  <Loader2 size={30} className="mb-4 animate-spin text-white" />
                  <span className="mb-1 font-mono text-sm font-semibold uppercase tracking-wider text-white">Rendering Stream…</span>
                  <p className="max-w-sm text-xs leading-normal text-neutral-400">
                    Gemini Omni Flash is generating frames. This usually takes 1-3 minutes.
                  </p>
                </div>
              </div>
            ) : (
              <CustomVideoPlayer
                src={item.videoUrl!}
                aspect="16:9"
                downloadUrl={item.videoUrl!}
                downloadName={`optiq_${item.id}.mp4`}
              />
            )}

            {/* 2 · PROMPT + REFERENCE IMAGES */}
            <PromptCard
              prompt={item.prompt}
              referenceImageUrls={refUrls}
              meta={
                <span className="truncate font-mono text-[9px] uppercase tracking-wider text-neutral-600">
                  {new Date(item.createdAt).toLocaleDateString()} · {item.id.slice(0, 10)}…
                </span>
              }
            />

            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-950/30 px-4 py-3 text-xs text-red-400">{error}</div>
            )}

            {/* 3 · OMNI REFINEMENT CONSOLE */}
            <div className="rounded-2xl border border-white/5 bg-[#0a0f1d]/80 p-4 backdrop-blur">
              <p className="text-[9px] font-bold font-mono uppercase tracking-widest text-neutral-500">
                Omni Refinement Console
              </p>
              <p className="mt-1 text-[11px] leading-normal text-neutral-500">
                Describe an adjustment (&ldquo;make it rain heavily&rdquo;, &ldquo;switch to a close-up tracking shot&rdquo;) — Omni renders a new take of this scene.
              </p>

              {(images.length > 0 || audioFile) && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {images.map((img) => (
                    <div key={img.id} className="group relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.preview} alt="Reference" className="h-12 w-14 rounded-lg border border-white/10 object-cover" />
                      <button
                        onClick={() => setImages((prev) => prev.filter((i) => i.id !== img.id))}
                        className="absolute -right-1.5 -top-1.5 rounded-full border border-white/10 bg-[#0a0f1d]/90 p-0.5 text-neutral-400 opacity-0 hover:text-white group-hover:opacity-100 transition-opacity"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                  {audioFile && (
                    <div className="flex items-center gap-2">
                      <AudioPlayerPreview audio={audioFile} />
                      <button onClick={() => setAudioFile(null)} className="text-neutral-500 hover:text-white">
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-[#0c152d]/60 p-2.5 focus-within:border-blue-500/50 transition-colors">
                <label className="cursor-pointer p-1.5 text-neutral-400 hover:text-white transition-colors" title="Attach reference image">
                  <ImagePlus size={15} />
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => Array.from(e.target.files || []).forEach(attachImage)}
                  />
                </label>
                <label className="cursor-pointer p-1.5 text-neutral-400 hover:text-white transition-colors" title="Attach voice reference">
                  <Mic size={15} />
                  <input
                    type="file"
                    accept="audio/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && attachAudio(e.target.files[0])}
                  />
                </label>
                <textarea
                  rows={1}
                  value={prompt}
                  onChange={(e) => {
                    setPrompt(e.target.value);
                    e.target.style.height = "auto";
                    e.target.style.height = `${e.target.scrollHeight}px`;
                  }}
                  placeholder="Instruct Omni to modify this video…"
                  className="max-h-24 flex-1 resize-none overflow-y-auto bg-transparent py-1 text-xs placeholder:text-neutral-600 focus:outline-none"
                />
                <button
                  onClick={() => void enhance()}
                  disabled={enhancing || !prompt.trim()}
                  title="Enhance prompt"
                  className="p-1.5 text-neutral-400 hover:text-white transition-colors disabled:opacity-40"
                >
                  {enhancing ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                </button>
                <button
                  onClick={() => prompt.trim() && setConfirmOpen(true)}
                  disabled={editing || !prompt.trim() || isRendering}
                  className="shrink-0 rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-500 transition-colors disabled:opacity-40 shadow-lg shadow-blue-500/20"
                >
                  {editing ? "Editing…" : "Omni Edit"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <ConfirmGenerationModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void runOmniEdit()}
        cost={EDIT_COST}
        balance={profile?.credits ?? 0}
        title="Confirm Video Modification"
        description={`You are about to modify this video with Omni. This will deduct GMD ${EDIT_COST.toFixed(2)} from your wallet balance.`}
        actionLabel="Omni Edit"
      />
    </div>
  );
}
