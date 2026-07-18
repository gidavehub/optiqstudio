"use client";

// ImageDetailClient — /dashboard/image/[id]. Single-column redesign: the still
// on top with hover actions, the prompt card directly beneath (clamped +
// tap-to-expand + copy + reference images), and a quick "remix" path back to
// the studio with the prompt pre-filled.

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Download, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useAuth } from "../../../../components/AuthProvider";
import PromptCard from "../../_shared/PromptCard";
import { useReferenceImages } from "../../_shared/useReferenceImages";
import { GenerationItem } from "./types";

export default function ImageDetailClient({ id }: { id: string }) {
  const { apiFetch, refreshProfile } = useAuth();
  const router = useRouter();

  const [item, setItem] = useState<GenerationItem | null>(null);
  const [loading, setLoading] = useState(true);

  const refUrls = useReferenceImages(item?.images);

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
      void refreshProfile();
    } catch {
      /* optimistic */
    }
    router.push("/dashboard/image");
  };

  return (
    <div className="h-full overflow-y-auto bg-black text-white">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-6 pb-16 pt-20">
        {/* Back + actions */}
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard/image"
            className="group flex w-fit items-center gap-1.5 text-[11px] font-bold font-mono uppercase tracking-wider text-neutral-500 hover:text-white transition-colors"
          >
            <ArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform" />
            Image Studio
          </Link>
          {item && (
            <div className="flex items-center gap-2">
              <Link
                href={`/dashboard/image?prompt=${encodeURIComponent(item.prompt)}`}
                className="flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-[#0c152d] px-3 py-1.5 text-[10px] font-semibold text-blue-400 hover:bg-[#131d35] transition-colors"
              >
                <RefreshCw size={11} /> Remix Prompt
              </Link>
              <button
                onClick={deleteItem}
                className="flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/5 px-3 py-1.5 text-[10px] font-semibold text-neutral-400 hover:border-red-500/30 hover:text-red-400 transition-colors"
              >
                <Trash2 size={11} /> Delete
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 text-neutral-500">
            <Loader2 size={24} className="animate-spin mb-3" />
            <span className="text-xs font-mono uppercase tracking-wider">Loading Still…</span>
          </div>
        ) : !item ? (
          <div className="rounded-2xl border border-white/5 bg-[#0c152d]/40 py-20 text-center">
            <p className="text-xs font-mono uppercase tracking-widest text-neutral-500">Image not found</p>
          </div>
        ) : (
          <>
            {/* 1 · THE STILL */}
            <div className="group relative overflow-hidden rounded-2xl border border-white/10 bg-[#070b16] shadow-2xl">
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
                  className="flex items-center justify-center rounded-lg border border-white/10 bg-black/80 p-2.5 text-white hover:bg-blue-600 transition-colors"
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
                <span className="truncate font-mono text-[9px] uppercase tracking-wider text-neutral-600">
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
