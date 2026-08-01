"use client";

// VideoDetailClient — /dashboard/video/[id]. Single-column redesign:
// player on top (download lives inside the player controls), the prompt card
// directly beneath (clamped + tap-to-expand + copy + reference images), and
// the Omni refinement console tucked below that.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, ImagePlus, Loader2, Mic, RotateCcw, Trash2, Wand2, X,
} from "lucide-react";
import { useAuth } from "../../../../components/AuthProvider";
import ConfirmGenerationModal from "../../../../components/ConfirmGenerationModal";
import PromptCard from "../../_shared/PromptCard";
import { useReferenceImages } from "../../_shared/useReferenceImages";
import { useReusePrompt } from "../../_shared/useReusePrompt";
import { stashPromptHandoff } from "../../_shared/promptHandoff";
import CustomVideoPlayer from "./CustomVideoPlayer";
import AudioPlayerPreview from "./AudioPlayerPreview";
import { AttachedAudio, AttachedImage, HistoryItem } from "./types";

/** An Optiq edit renders a fresh 10s clip, so it costs exactly what one costs. */
const EDIT_SECONDS = 10;

export default function VideoDetailClient({ id }: { id: string }) {
  const { apiFetch, profile, pricing, refreshProfile } = useAuth();
  const router = useRouter();
  const editCost = (pricing?.costs.videoPerSecond?.omni ?? 15) * EDIT_SECONDS;

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
  const [reusing, setReusing] = useState(false);

  const refUrls = useReferenceImages(item?.images);
  const reusePrompt = useReusePrompt();

  // Sends the prompt AND its reference images back to the studio console.
  const reuse = async () => {
    if (!item || reusing) return;
    setReusing(true);
    const reused = await reusePrompt(item.id);
    if (reused) stashPromptHandoff(reused);
    router.push("/dashboard/video");
  };

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
    <div className="h-full overflow-y-auto bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-6 pb-16 pt-20">
        {/* Back */}
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard/video"
            className="group flex w-fit items-center gap-1.5 text-[11px] font-bold tabular-nums uppercase tracking-wider text-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform" />
            Video Studio
          </Link>
          {item && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => void reuse()}
                disabled={reusing}
                title="Reuse this prompt and its reference images"
                className="flex items-center gap-1.5 rounded-xl border border-accent-line bg-surface px-3 py-1.5 text-[10px] font-semibold text-accent-ink transition-colors hover:bg-surface-2 disabled:opacity-50"
              >
                {reusing ? <Loader2 size={11} className="animate-spin" /> : <RotateCcw size={11} />}
                Reuse Prompt
              </button>
              <button
                onClick={deleteItem}
                className="flex items-center gap-1.5 rounded-xl border border-line bg-surface px-3 py-1.5 text-[10px] font-semibold text-ink-3 hover:border-danger hover:text-danger transition-colors"
              >
                <Trash2 size={11} /> Delete
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-muted">
            <Loader2 size={24} className="animate-spin mb-3" />
            <span className="text-xs tabular-nums uppercase tracking-wider">Loading Project…</span>
          </div>
        ) : !item ? (
          <div className="rounded-[28px] border border-line bg-surface py-20 text-center">
            <p className="text-xs tabular-nums uppercase tracking-widest text-muted">Video not found</p>
          </div>
        ) : (
          <>
            {/* 1 · PLAYER */}
            {isRendering ? (
              <div className="relative aspect-video overflow-hidden rounded-3xl border border-line bg-background">
                <div className="absolute -inset-[20px] opacity-40">
                  <div className="absolute top-1/4 left-1/4 h-40 w-40 rounded-full bg-accent-soft blur-3xl animate-pulse" style={{ animationDuration: "4s" }} />
                  <div className="absolute bottom-1/4 right-1/4 h-44 w-44 rounded-full bg-accent-soft blur-3xl animate-pulse" style={{ animationDuration: "6s" }} />
                </div>
                <div className="absolute inset-0 bg-background/50 backdrop-blur-2xl" />
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-8 text-center">
                  <Loader2 size={30} className="mb-4 animate-spin text-foreground" />
                  <span className="mb-1 tabular-nums text-sm font-semibold uppercase tracking-wider text-foreground">Rendering Stream…</span>
                  <p className="max-w-sm text-xs leading-normal text-ink-3">
                    The Optiq Video Engine is generating frames. This usually takes 1-3 minutes.
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
                <span className="truncate tabular-nums text-[9px] uppercase tracking-wider text-faint">
                  {new Date(item.createdAt).toLocaleDateString()} · {item.id.slice(0, 10)}…
                </span>
              }
            />

            {error && (
              <div className="rounded-3xl border border-danger bg-danger-soft px-4 py-3 text-xs text-danger">{error}</div>
            )}

            {/* 3 · OMNI REFINEMENT CONSOLE */}
            <div className="rounded-[28px] border border-line bg-surface/85 p-4 backdrop-blur">
              <p className="text-[9px] font-bold tabular-nums uppercase tracking-widest text-muted">
                Optiq Refinement Console
              </p>
              <p className="mt-1 text-[11px] leading-normal text-muted">
                Describe an adjustment (&ldquo;make it rain heavily&rdquo;, &ldquo;switch to a close-up tracking shot&rdquo;) — Optiq renders a new take of this scene.
              </p>

              {(images.length > 0 || audioFile) && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {images.map((img) => (
                    <div key={img.id} className="group relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.preview} alt="Reference" className="h-12 w-14 rounded-xl border border-line object-cover" />
                      <button
                        onClick={() => setImages((prev) => prev.filter((i) => i.id !== img.id))}
                        className="absolute -right-1.5 -top-1.5 rounded-full border border-line bg-surface/90 p-0.5 text-ink-3 opacity-0 hover:text-foreground group-hover:opacity-100 transition-opacity"
                      >
                        <X size={10} />
                      </button>
                    </div>
                  ))}
                  {audioFile && (
                    <div className="flex items-center gap-2">
                      <AudioPlayerPreview audio={audioFile} />
                      <button onClick={() => setAudioFile(null)} className="text-muted hover:text-foreground">
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-3 flex items-center gap-2 rounded-2xl border border-line bg-surface p-2.5 focus-within:border-accent-line transition-colors">
                <label className="cursor-pointer p-1.5 text-ink-3 hover:text-foreground transition-colors" title="Attach reference image">
                  <ImagePlus size={15} />
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => Array.from(e.target.files || []).forEach(attachImage)}
                  />
                </label>
                <label className="cursor-pointer p-1.5 text-ink-3 hover:text-foreground transition-colors" title="Attach voice reference">
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
                  placeholder="Instruct Optiq to modify this video…"
                  className="max-h-24 flex-1 resize-none overflow-y-auto bg-transparent py-1 text-xs placeholder:text-faint focus:outline-none"
                />
                <button
                  onClick={() => void enhance()}
                  disabled={enhancing || !prompt.trim()}
                  title="Enhance prompt"
                  className="p-1.5 text-ink-3 hover:text-foreground transition-colors disabled:opacity-40"
                >
                  {enhancing ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
                </button>
                <button
                  onClick={() => prompt.trim() && setConfirmOpen(true)}
                  disabled={editing || !prompt.trim() || isRendering}
                  className="shrink-0 rounded-xl bg-accent px-4 py-1.5 text-xs font-bold text-white hover:bg-accent-hover transition-colors disabled:opacity-40 shadow-lg shadow-accent/15"
                >
                  {editing ? "Editing…" : "Optiq Edit"}
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
        cost={editCost}
        balance={profile?.credits ?? 0}
        title="Confirm Video Modification"
        description={`Optiq video edit — new ${EDIT_SECONDS}s clip`}
        actionLabel="Optiq Edit"
      />
    </div>
  );
}
