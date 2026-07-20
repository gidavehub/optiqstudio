"use client";

// ImportMediaModal — the editor's import hub. Opened from the Media Bin's
// Import button. Three faces:
//   Upload        → drop/browse new files (stored in the per-user library
//                   folder, registered in users/{uid}/mediaLibrary)
//   My Library    → everything this user has ever uploaded, across projects
//   Direct Studio → clips/images/audio generated in the Video, Image and
//                   Audio studios (the `generations` collection)
// Selected items are imported into the project's mediaLibrary so they appear
// in the Media Bin and can be dragged onto the timeline.

import React, { useEffect, useMemo, useState } from "react";
import {
  Check, Clapperboard, FolderOpen, ImageIcon, Loader2, Music,
  Upload, Video, X,
} from "lucide-react";
import {
  collection, doc as fsDoc, getDocs, query, updateDoc, where, arrayUnion,
} from "firebase/firestore";
import { db } from "../../../../lib/firebase";
import { genId } from "../../../../lib/editor";
import type { LibraryItem } from "./MediaBin";

type Tab = "upload" | "library" | "studio";
type KindFilter = "all" | "video" | "image" | "audio";

interface ImportMediaModalProps {
  open: boolean;
  onClose: () => void;
  user: { uid: string } | null;
  projectId: string | null;
  /** URLs already in the project's media library (grayed out as "added"). */
  existingUrls: string[];
  /** Upload pipeline owned by MediaBin (progress renders in the bin). */
  onUploadFiles: (files: FileList | File[]) => void;
  uploads: { name: string; pct: number }[];
}

const KIND_CHIPS: { id: KindFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "video", label: "Videos" },
  { id: "image", label: "Images" },
  { id: "audio", label: "Audio" },
];

export default function ImportMediaModal({
  open, onClose, user, projectId, existingUrls, onUploadFiles, uploads,
}: ImportMediaModalProps) {
  const [tab, setTab] = useState<Tab>("upload");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [studioItems, setStudioItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Record<string, LibraryItem>>({});
  const [importing, setImporting] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Load both sources fresh each time the modal opens.
  useEffect(() => {
    if (!open || !user) return;
    setSelected({});
    setLoading(true);
    void (async () => {
      try {
        const [librarySnap, generationsSnap] = await Promise.all([
          getDocs(collection(db, "users", user.uid, "mediaLibrary")),
          getDocs(query(collection(db, "generations"), where("uid", "==", user.uid))),
        ]);

        const lib = librarySnap.docs
          .map((d) => ({ ...(d.data() as LibraryItem), id: d.id }))
          .filter((m) => m.url)
          .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
        setLibraryItems(lib);

        const gens = generationsSnap.docs
          .map((d) => {
            const g = d.data() as any;
            const kind: KindFilter | null = g.videoUrl
              ? "video"
              : g.imageUrl
              ? "image"
              : g.audioUrl
              ? "audio"
              : null;
            if (!kind || g.status !== "succeeded") return null;
            return {
              id: d.id,
              kind,
              url: g.videoUrl || g.imageUrl || g.audioUrl,
              label: (g.prompt || g.type || "Generation").slice(0, 60),
              createdAt: g.createdAt,
              ...(g.durationSeconds ? { duration: g.durationSeconds } : {}),
            } as LibraryItem;
          })
          .filter(Boolean) as LibraryItem[];
        gens.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
        setStudioItems(gens);
      } catch (err) {
        console.error("Failed to load media sources:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [open, user]);

  const items = tab === "library" ? libraryItems : studioItems;
  const filtered = useMemo(
    () => (kindFilter === "all" ? items : items.filter((m) => m.kind === kindFilter)),
    [items, kindFilter]
  );

  const toggleSelect = (item: LibraryItem) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[item.url]) delete next[item.url];
      else next[item.url] = item;
      return next;
    });
  };

  const selectedCount = Object.keys(selected).length;

  const importSelected = async () => {
    if (!projectId || selectedCount === 0) return;
    setImporting(true);
    try {
      const fresh = Object.values(selected)
        .filter((m) => !existingUrls.includes(m.url))
        .map((m) => ({ ...m, id: genId("med") }));
      if (fresh.length > 0) {
        await updateDoc(fsDoc(db, "projects", projectId), {
          mediaLibrary: arrayUnion(...fresh),
          updatedAt: new Date().toISOString(),
        });
      }
      onClose();
    } catch (err) {
      console.error("Failed to import media into project:", err);
    } finally {
      setImporting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div className="relative flex h-[min(640px,90vh)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-blue-500 bg-[#070e24]/95 shadow-2xl backdrop-blur-2xl animate-in fade-in-50 zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
          <h3 className="flex items-center gap-2 text-base font-bold tracking-tight text-white">
            <div className="flex items-center gap-1 shrink-0">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              <div className="h-1.5 w-1.5 rounded-full border border-blue-400/40 bg-transparent" />
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            </div>
            Import Media
          </h3>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-neutral-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <X size={15} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-white/5 px-5 py-3">
          {[
            { id: "upload" as Tab, label: "Upload", icon: Upload },
            { id: "library" as Tab, label: "My Library", icon: FolderOpen },
            { id: "studio" as Tab, label: "Direct Studio", icon: Clapperboard },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all ${
                tab === id
                  ? "border-blue-500 bg-[#0c152d] text-white shadow-lg shadow-blue-500/10"
                  : "border-white/5 bg-white/[0.03] text-neutral-400 hover:border-white/10 hover:text-white"
              }`}
            >
              <Icon size={12} className={tab === id ? "text-blue-400" : ""} /> {label}
            </button>
          ))}

          {tab !== "upload" && (
            <div className="ml-auto flex items-center gap-1">
              {KIND_CHIPS.map((chip) => (
                <button
                  key={chip.id}
                  onClick={() => setKindFilter(chip.id)}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition-all ${
                    kindFilter === chip.id
                      ? "bg-blue-600/30 text-blue-300 border border-blue-500/40"
                      : "border border-transparent text-neutral-500 hover:text-neutral-300"
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {tab === "upload" ? (
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files?.length) onUploadFiles(e.dataTransfer.files);
              }}
              className={`flex h-full min-h-[280px] cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed text-center transition-all ${
                dragOver
                  ? "border-blue-500/70 bg-[#0c152d]/70 scale-[1.005]"
                  : "border-white/10 bg-white/[0.02] hover:border-blue-500/40"
              }`}
            >
              <input
                type="file"
                accept="video/*,audio/*,image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) onUploadFiles(e.target.files);
                  e.target.value = "";
                }}
              />
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-[#0e1630] text-blue-400">
                <Upload size={18} />
              </span>
              <span className="text-sm font-bold text-white">Drop files or click to browse</span>
              <span className="mt-1.5 text-[11px] text-neutral-500">
                Videos, images and audio — saved to your library for every project
              </span>
              {uploads.length > 0 && (
                <div className="mt-5 w-full max-w-xs space-y-2">
                  {uploads.map((u) => (
                    <div key={u.name} className="rounded-lg border border-blue-500/20 bg-[#0c152d]/60 px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <Loader2 size={10} className="shrink-0 animate-spin text-blue-400" />
                        <span className="truncate text-[10px] font-semibold text-neutral-300">{u.name}</span>
                        <span className="ml-auto font-mono text-[9px] text-blue-400">{u.pct}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </label>
          ) : loading ? (
            <div className="flex h-full min-h-[280px] items-center justify-center">
              <Loader2 size={22} className="animate-spin text-blue-400" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-full min-h-[280px] flex-col items-center justify-center text-center">
              {tab === "library" ? (
                <FolderOpen size={22} className="mb-3 text-neutral-600" />
              ) : (
                <Clapperboard size={22} className="mb-3 text-neutral-600" />
              )}
              <p className="text-xs font-bold text-neutral-400">
                {tab === "library" ? "Nothing uploaded yet" : "No Direct Studio creations yet"}
              </p>
              <p className="mt-1 max-w-xs text-[10px] text-neutral-600">
                {tab === "library"
                  ? "Files you upload are kept here, ready for any project."
                  : "Clips, images and voices you generate in the studios land here automatically."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {filtered.map((m) => {
                const isSelected = !!selected[m.url];
                const alreadyAdded = existingUrls.includes(m.url);
                return (
                  <button
                    key={`${m.id}-${m.url}`}
                    disabled={alreadyAdded}
                    onClick={() => toggleSelect(m)}
                    className={`group relative overflow-hidden rounded-xl border text-left transition-all duration-200 ${
                      alreadyAdded
                        ? "cursor-default border-white/5 opacity-35"
                        : isSelected
                        ? "border-blue-500 ring-2 ring-blue-500/30 shadow-lg shadow-blue-500/10"
                        : "border-white/5 hover:border-blue-500/50"
                    }`}
                  >
                    <div className="relative aspect-video bg-[#0c152d]">
                      {m.kind === "video" ? (
                        <video
                          src={m.url}
                          muted
                          playsInline
                          preload="metadata"
                          className="pointer-events-none h-full w-full object-cover"
                        />
                      ) : m.kind === "image" ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={m.url} alt={m.label} className="pointer-events-none h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Music size={20} className="text-emerald-400/70" />
                        </div>
                      )}
                      <span className="absolute bottom-1 left-1 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[7px] font-bold font-mono uppercase text-white">
                        {m.kind === "video" ? <Video size={7} /> : m.kind === "image" ? <ImageIcon size={7} /> : <Music size={7} />}
                        {m.kind}
                      </span>
                      {(isSelected || alreadyAdded) && (
                        <span
                          className={`absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full text-white shadow ${
                            alreadyAdded ? "bg-neutral-600" : "bg-blue-600"
                          }`}
                        >
                          <Check size={11} />
                        </span>
                      )}
                    </div>
                    <p className="truncate bg-[#0a0f1d] px-2 py-1.5 text-[9px] font-semibold text-neutral-400">
                      {alreadyAdded ? "In project" : m.label || m.kind}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {tab !== "upload" && (
          <div className="flex items-center justify-between border-t border-white/5 px-5 py-3.5">
            <span className="font-mono text-[10px] text-neutral-500">
              {selectedCount > 0 ? `${selectedCount} selected` : "Tap items to select"}
            </span>
            <button
              disabled={selectedCount === 0 || importing}
              onClick={() => void importSelected()}
              className={`flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-bold transition-all ${
                selectedCount === 0 || importing
                  ? "cursor-not-allowed bg-[#0e1630] text-neutral-600"
                  : "bg-blue-600 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-500"
              }`}
            >
              {importing ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
              Import{selectedCount > 0 ? ` ${selectedCount}` : ""} to Project
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
