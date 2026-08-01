"use client";

// ImageDetailClient — /dashboard/image/[id]. Single-column redesign: the still
// on top with hover actions, the prompt card directly beneath (clamped +
// tap-to-expand + copy + reference images), and a quick "remix" path back to
// the studio with the prompt pre-filled.

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, Loader2, RotateCcw, Trash2 } from "lucide-react";
import { useAuth } from "../../../../components/AuthProvider";
import PromptCard from "../../_shared/PromptCard";
import { useReferenceImages } from "../../_shared/useReferenceImages";
import { useReusePrompt } from "../../_shared/useReusePrompt";
import { stashPromptHandoff } from "../../_shared/promptHandoff";
import { GenerationItem } from "./types";

export default function ImageDetailClient({ id }: { id: string }) {
  const { apiFetch } = useAuth();
  const router = useRouter();

  const [item, setItem] = useState<GenerationItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [reusing, setReusing] = useState(false);

  const refUrls = useReferenceImages(item?.images);
  const reusePrompt = useReusePrompt();

  // Carries the prompt AND the reference images back to the studio — the old
  // "remix" link took only the text, so the images that shaped the still were
  // silently lost.
  const reuse = async () => {
    if (!item || reusing) return;
    setReusing(true);
    const reused = await reusePrompt(item.id);
    if (reused) stashPromptHandoff(reused);
    router.push("/dashboard/image");
  };

  const load = useCallback(async () => {
    try {
      const d = await apiFetch<{ items: GenerationItem[] }>("/api/generations?type=image");
      setItem(d.items.find((i) => i.id === id) ?? null);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, [apiFetch, id]);

  useEffect(() => {
    void load();
  }, [load]);

  const deleteItem = async () => {
    if (!item || !confirm("Permanently delete this image?")) return;
    try {
      await apiFetch(`/api/generations?id=${item.id}`, { method: "DELETE" });
    } catch {
      /* optimistic */
    }
    router.push("/dashboard/image");
  };

  return (
    <div className="h-full overflow-y-auto bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-6 pb-16 pt-20">
        {/* Back + actions */}
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard/image"
            className="group flex w-fit items-center gap-1.5 text-[11px] font-bold tabular-nums uppercase tracking-wider text-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform" />
            Image Studio
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
            <span className="text-xs tabular-nums uppercase tracking-wider">Loading Still…</span>
          </div>
        ) : !item ? (
          <div className="rounded-[28px] border border-line bg-surface py-20 text-center">
            <p className="text-xs tabular-nums uppercase tracking-widest text-muted">Image not found</p>
          </div>
        ) : (
          <>
            {/* 1 · THE STILL */}
            <div className="group relative overflow-hidden rounded-3xl border border-line bg-background elevate-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.imageUrl} alt={item.prompt} className="mx-auto max-h-[70vh] w-auto object-contain" />
              {/* Hover actions */}
              <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                <a
                  href={item.imageUrl}
                  download={`optiq-${item.id}.jpg`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Download image"
                  className="flex items-center justify-center rounded-xl border border-line bg-background/85 backdrop-blur-sm p-2.5 text-foreground hover:bg-accent transition-colors"
                >
                  <Download size={15} />
                </a>
              </div>
            </div>

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
          </>
        )}
      </div>
    </div>
  );
}
