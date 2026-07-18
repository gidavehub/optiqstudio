"use client";

// AudioDetailClient — /dashboard/audio/[id]. Single-column redesign: the take
// monitor player on top, the narration script directly beneath (clamped +
// tap-to-expand + copy), and quick actions (reuse script, delete).

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { useAuth } from "../../../../components/AuthProvider";
import PromptCard from "../../_shared/PromptCard";
import CustomAudioPlayer from "./CustomAudioPlayer";
import { AudioItem } from "./types";

export default function AudioDetailClient({ id }: { id: string }) {
  const { apiFetch, refreshProfile } = useAuth();
  const router = useRouter();

  const [item, setItem] = useState<AudioItem | null>(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await apiFetch<{ items: AudioItem[] }>("/api/generations?type=audio");
      const found = d.items.find((i) => i.id === id) ?? null;
      setItem(found);
      return found;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  }, [apiFetch, id]);

  useEffect(() => {
    void load();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [load]);

  const isRendering = !!item && item.status === "queued";

  // Poll cloning jobs still rendering on the GPU worker
  useEffect(() => {
    if (!isRendering || pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const status = await apiFetch<{ status: string }>(`/api/video/status?id=${id}`);
        if (status.status === "succeeded" || status.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          void refreshProfile();
          void load();
        }
      } catch {
        /* ignore */
      }
    }, 4000);
  }, [isRendering, apiFetch, id, load, refreshProfile]);

  const deleteItem = async () => {
    if (!item || !confirm("Permanently delete this take?")) return;
    try {
      await apiFetch(`/api/generations?id=${item.id}`, { method: "DELETE" });
      void refreshProfile();
    } catch {
      /* optimistic */
    }
    router.push("/dashboard/audio");
  };

  return (
    <div className="h-full overflow-y-auto bg-black text-white">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-6 pb-16 pt-20">
        {/* Back + actions */}
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard/audio"
            className="group flex w-fit items-center gap-1.5 text-[11px] font-bold font-mono uppercase tracking-wider text-neutral-500 hover:text-white transition-colors"
          >
            <ArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform" />
            Voice Studio
          </Link>
          {item && (
            <div className="flex items-center gap-2">
              <Link
                href={`/dashboard/audio`}
                className="flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-[#0c152d] px-3 py-1.5 text-[10px] font-semibold text-blue-400 hover:bg-[#131d35] transition-colors"
              >
                <RefreshCw size={11} /> New Take
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
            <span className="text-xs font-mono uppercase tracking-wider">Loading Take…</span>
          </div>
        ) : !item ? (
          <div className="rounded-2xl border border-white/5 bg-[#0c152d]/40 py-20 text-center">
            <p className="text-xs font-mono uppercase tracking-widest text-neutral-500">Take not found</p>
          </div>
        ) : (
          <>
            {/* 1 · MONITOR PLAYER */}
            {isRendering || !item.audioUrl ? (
              <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#070b16] p-10 text-center">
                <div className="absolute -inset-[20px] opacity-40">
                  <div className="absolute top-0 left-1/4 h-32 w-32 rounded-full bg-emerald-600/15 blur-3xl animate-pulse" style={{ animationDuration: "4s" }} />
                  <div className="absolute bottom-0 right-1/4 h-36 w-36 rounded-full bg-blue-500/15 blur-3xl animate-pulse" style={{ animationDuration: "6s" }} />
                </div>
                <div className="relative z-10 flex flex-col items-center">
                  <Loader2 size={26} className="mb-3 animate-spin text-white" />
                  <span className="font-mono text-xs font-semibold uppercase tracking-wider text-white">
                    Synthesizing Custom Voice…
                  </span>
                  <p className="mt-1 text-[10px] text-neutral-500">The GPU worker is rendering your take.</p>
                </div>
              </div>
            ) : (
              <CustomAudioPlayer src={item.audioUrl} />
            )}

            {/* 2 · SCRIPT */}
            <PromptCard
              prompt={item.prompt}
              meta={
                <span className="truncate font-mono text-[9px] uppercase tracking-wider text-neutral-600">
                  {item.id.startsWith("voice_") ? "AI Cloned Take" : "Prebuilt Speaker"} ·{" "}
                  {new Date(item.createdAt).toLocaleDateString()}
                </span>
              }
            />
          </>
        )}
      </div>
    </div>
  );
}
