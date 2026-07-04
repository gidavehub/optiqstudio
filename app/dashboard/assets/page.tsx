"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Download, FolderOpen, Mic } from "lucide-react";
import { useAuth } from "../../../components/AuthProvider";

interface AssetItem {
  id: string;
  type: string;
  status: string;
  prompt: string;
  videoUrl: string | null;
  imageUrl: string | null;
  audioUrl: string | null;
  createdAt: string;
}

const FILTERS = ["All", "Video", "Image", "Character", "Audio"] as const;

export default function AssetsPage() {
  const { apiFetch } = useAuth();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("All");
  const [items, setItems] = useState<AssetItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(() => {
    const qs = filter === "All" ? "" : `?type=${filter.toLowerCase()}`;
    apiFetch<{ items: AssetItem[] }>(`/api/generations${qs}`)
      .then((d) => setItems(d.items.filter((i) => i.status === "succeeded")))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [apiFetch, filter]);

  useEffect(load, [load]);

  return (
    <div className="mx-auto max-w-6xl overflow-y-auto px-8 py-10">
      <h1 className="text-[26px] font-semibold tracking-tight">Assets</h1>
      <p className="mt-1 text-[13px] text-neutral-500">
        Everything you&apos;ve generated, stored in your library.
      </p>

      <div className="mt-6 flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3.5 py-1.5 text-xs transition-colors ${
              filter === f
                ? "bg-white text-black font-medium"
                : "bg-white/5 text-neutral-400 hover:text-white"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="mt-24 text-center text-neutral-600">
          <FolderOpen size={26} className="mx-auto" />
          <p className="mt-3 text-sm">
            {loaded ? "Nothing here yet — generate something." : "Loading…"}
          </p>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => {
            const url = item.videoUrl || item.imageUrl || item.audioUrl;
            return (
              <div
                key={item.id}
                className="group overflow-hidden rounded-xl border border-line bg-surface"
              >
                <div className="relative aspect-video bg-black">
                  {item.videoUrl ? (
                    <video
                      src={item.videoUrl}
                      muted
                      loop
                      playsInline
                      className="h-full w-full object-cover"
                      onMouseEnter={(e) => void e.currentTarget.play()}
                      onMouseLeave={(e) => e.currentTarget.pause()}
                    />
                  ) : item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt={item.prompt} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-neutral-600">
                      <Mic size={18} />
                      {item.audioUrl && <audio src={item.audioUrl} controls className="w-11/12" />}
                    </div>
                  )}
                  {url && (
                    <a
                      href={url}
                      download
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md bg-black/60 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100"
                      title="Download"
                    >
                      <Download size={13} />
                    </a>
                  )}
                </div>
                <div className="px-3 py-2.5">
                  <p className="truncate text-[12px] text-neutral-400" title={item.prompt}>
                    {item.prompt}
                  </p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wider text-neutral-600">
                    {item.type} · {new Date(item.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
