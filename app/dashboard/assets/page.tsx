"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Download, FolderOpen, Mic, Trash2 } from "lucide-react";
import { useAuth } from "../../../components/AuthProvider";
import { gridBox, recordAspect } from "../_shared/aspect";

interface AssetItem {
  id: string;
  type: string;
  status: string;
  prompt: string;
  videoUrl: string | null;
  imageUrl: string | null;
  audioUrl: string | null;
  createdAt: string;
  /** Shape the asset was generated at, so its tile is cut to match. */
  aspectRatio?: string | null;
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

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await apiFetch(`/api/generations?id=${id}`, {
        method: "DELETE"
      });
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (err) {
      console.error("Failed to delete asset:", err);
      // Optimistic delete
      setItems((prev) => prev.filter((item) => item.id !== id));
    }
  };

  useEffect(load, [load]);

  return (
    <div className="h-full overflow-y-auto">
      {/* pt-20/24 clears the floating chrome — the logo pill was sitting on the
          "Assets" heading. Same clearance the portal and the detail views use. */}
      <div className="mx-auto max-w-6xl px-8 pb-10 pt-20 sm:pt-24">
      <h1 className="text-[26px] font-semibold tracking-tight">Assets</h1>
      <p className="mt-1 text-[13px] text-muted">
        Everything you&apos;ve generated, stored in your library.
      </p>

      <div className="mt-6 flex gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3.5 py-1.5 text-xs transition-colors ${
              filter === f
                ? "bg-foreground text-background font-medium"
                : "bg-surface text-ink-3 hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="mt-24 text-center text-faint">
          <FolderOpen size={26} className="mx-auto" />
          <p className="mt-3 text-sm">
            {loaded ? "Nothing here yet — generate something." : "Loading…"}
          </p>
        </div>
      ) : (
        // items-start so a portrait tile does not stretch its landscape row-mates
        <div className="mt-8 grid grid-cols-2 items-start gap-4 md:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => {
            const url = item.videoUrl || item.imageUrl || item.audioUrl;
            const box = gridBox(recordAspect(item));
            return (
              <div
                key={item.id}
                className="group overflow-hidden rounded-2xl border border-line bg-surface"
              >
                <div className={`relative bg-background ${box.className}`} style={box.style}>
                  {item.videoUrl ? (
                    <video
                      src={item.videoUrl}
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="auto"
                      className="h-full w-full object-cover"
                    />
                  ) : item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt={item.prompt} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-faint">
                      <Mic size={18} />
                      {item.audioUrl && <audio src={item.audioUrl} controls className="w-11/12" />}
                    </div>
                  )}
                  {url && (
                    <div className="absolute right-2 top-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm z-10">
                      <a
                        href={url}
                        download
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-background/80 backdrop-blur-sm hover:bg-surface border border-line text-foreground"
                        title="Download"
                      >
                        <Download size={13} />
                      </a>
                      <button
                        onClick={(e) => handleDelete(item.id, e)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-background/80 backdrop-blur-sm hover:bg-danger-soft border border-line text-ink-3 hover:text-danger"
                        title="Delete"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="px-3 py-2.5">
                  <p className="truncate text-[12px] text-ink-3" title={item.prompt}>
                    {item.prompt}
                  </p>
                  <p className="mt-0.5 text-[10px] uppercase tracking-wider text-faint">
                    {item.type} · {new Date(item.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    </div>
  );
}
