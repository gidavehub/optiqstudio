"use client";

// MediaBin — left rail of the editor. Lists the project's generated scene
// clips, the compiled legacy film, and the project's own media library
// (user uploads: video / image / audio, stored under the project in Firebase
// Storage and listed in the project doc's `mediaLibrary` field so they
// persist). Everything is draggable onto the timeline; "+" inserts at the
// playhead using the auto-layering placement policy.

import React, { useRef, useState } from "react";
import { Clapperboard, Film, ImageIcon, Loader2, Music, Plus, Upload } from "lucide-react";
import { doc as fsDoc, updateDoc, arrayUnion, addDoc, collection } from "firebase/firestore";
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { db, storage } from "../../../../lib/firebase";
import { useAuth } from "../../../../components/AuthProvider";
import { EditorEngine, EditorDoc, genId } from "../../../../lib/editor";
import ImportMediaModal from "./ImportMediaModal";
import {
  MEDIA_DRAG_TYPE, MediaPayload, placeMediaOnTimeline, setActiveDragPayload, withDuration,
} from "./placement";

export interface LibraryItem extends MediaPayload {
  id: string;
  path?: string;
  createdAt?: string;
}

interface MediaBinProps {
  project: any;
  engine: EditorEngine;
  doc: EditorDoc;
  playhead: number;
  width: number;
}

function fileKind(file: File): MediaPayload["kind"] | null {
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("image/")) return "image";
  return null;
}

/** Read intrinsic duration / dimensions from a local file before uploading. */
function probeFile(file: File, kind: MediaPayload["kind"]): Promise<Partial<MediaPayload>> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const finish = (meta: Partial<MediaPayload>) => {
      URL.revokeObjectURL(url);
      resolve(meta);
    };
    const timer = setTimeout(() => finish({}), 8000);
    if (kind === "image") {
      const img = new window.Image();
      img.onload = () => { clearTimeout(timer); finish({ width: img.naturalWidth, height: img.naturalHeight }); };
      img.onerror = () => { clearTimeout(timer); finish({}); };
      img.src = url;
    } else {
      const el = document.createElement(kind === "audio" ? "audio" : "video");
      el.preload = "metadata";
      el.onloadedmetadata = () => {
        clearTimeout(timer);
        const meta: Partial<MediaPayload> = {
          duration: Number.isFinite(el.duration) ? el.duration : undefined,
        };
        if (kind === "video") {
          meta.width = (el as HTMLVideoElement).videoWidth || undefined;
          meta.height = (el as HTMLVideoElement).videoHeight || undefined;
        }
        finish(meta);
      };
      el.onerror = () => { clearTimeout(timer); finish({}); };
      el.src = url;
    }
  });
}

export default function MediaBin({ project, engine, doc, playhead, width }: MediaBinProps) {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploads, setUploads] = useState<{ name: string; pct: number }[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const sceneClips: { label: string; url: string }[] = Object.entries(project?.videoStatus ?? {})
    .filter(([, s]: [string, any]) => s?.status === "succeeded" && s?.url)
    .map(([idx, s]: [string, any]) => ({ label: `Scene ${Number(idx) + 1}`, url: s.url }));

  const library: LibraryItem[] = Array.isArray(project?.mediaLibrary) ? project.mediaLibrary : [];
  const visualMedia = library.filter((m) => m.kind === "video" || m.kind === "image");
  const audioMedia = library.filter((m) => m.kind === "audio");

  const addToTimeline = async (payload: MediaPayload) => {
    const resolved = await withDuration(payload);
    placeMediaOnTimeline(engine, resolved, playhead);
  };

  // ── Uploads ────────────────────────────────────────────────────────────
  const uploadFiles = async (files: FileList | File[]) => {
    if (!user || !project?.id) return;
    setUploadError(null);
    for (const file of Array.from(files)) {
      const kind = fileKind(file);
      if (!kind) {
        setUploadError(`${file.name}: unsupported file type`);
        continue;
      }
      const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-80);
      // Per-user library folders (users/{uid}/library/{videos|images|audio}) so
      // every upload is organized by owner + type and reusable across projects.
      const folder = kind === "audio" ? "audio" : `${kind}s`;
      const path = `users/${user.uid}/library/${folder}/${Date.now()}_${safeName}`;
      setUploads((u) => [...u, { name: file.name, pct: 0 }]);
      try {
        const meta = await probeFile(file, kind);
        const task = uploadBytesResumable(storageRef(storage, path), file, {
          contentType: file.type,
          cacheControl: "public, max-age=31536000",
        });
        await new Promise<void>((resolve, reject) => {
          task.on(
            "state_changed",
            (snap) => {
              const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
              setUploads((u) => u.map((x) => (x.name === file.name ? { ...x, pct } : x)));
            },
            reject,
            () => resolve()
          );
        });
        const url = await getDownloadURL(task.snapshot.ref);
        const item: LibraryItem = {
          id: genId("med"),
          kind,
          url,
          path,
          label: file.name.replace(/\.[^.]+$/, ""),
          ...(meta.duration !== undefined ? { duration: meta.duration } : {}),
          ...(meta.width !== undefined ? { width: meta.width } : {}),
          ...(meta.height !== undefined ? { height: meta.height } : {}),
          createdAt: new Date().toISOString(),
        };
        await updateDoc(fsDoc(db, "projects", project.id), {
          mediaLibrary: arrayUnion(item),
          updatedAt: new Date().toISOString(),
        });
        // Register in the user-level library too, so the Import popup's
        // "My Library" tab can offer this file to every future project.
        await addDoc(collection(db, "users", user.uid, "mediaLibrary"), item);
      } catch (err: any) {
        console.error("Media upload failed:", err);
        setUploadError(`${file.name}: ${err?.message ?? "upload failed"}`);
      } finally {
        setUploads((u) => u.filter((x) => x.name !== file.name));
      }
    }
  };

  const dragProps = (payload: MediaPayload) => ({
    draggable: true,
    onDragStart: (e: React.DragEvent) => {
      e.dataTransfer.setData(MEDIA_DRAG_TYPE, JSON.stringify(payload));
      e.dataTransfer.effectAllowed = "copy";
      // Published so the timeline can hit-test kind/duration DURING the hover
      // (dataTransfer payloads are unreadable until the drop).
      setActiveDragPayload(payload);
    },
    onDragEnd: () => setActiveDragPayload(null),
  });

  return (
    <aside
      style={{ width }}
      className="flex shrink-0 flex-col border-r border-white/5 bg-[#0a0f1d]/80"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setDragOver(true);
        }
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        if (e.dataTransfer.files?.length) {
          e.preventDefault();
          setDragOver(false);
          void uploadFiles(e.dataTransfer.files);
        }
      }}
    >
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
        <span className="text-[9px] font-bold font-mono uppercase tracking-widest text-neutral-500">
          Media Bin
        </span>
        <button
          onClick={() => setImportOpen(true)}
          className="flex items-center gap-1 rounded-md bg-blue-600/20 border border-blue-500/30 px-2 py-1 text-[9px] font-bold text-blue-400 hover:bg-blue-600/30 transition-colors"
        >
          <Upload size={9} /> Import
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,audio/*,image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) void uploadFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <div className="relative min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
        {dragOver && (
          <div className="pointer-events-none absolute inset-2 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-blue-500/60 bg-[#0c152d]/80 backdrop-blur-sm">
            <span className="text-[10px] font-bold font-mono uppercase tracking-widest text-blue-400">
              Drop to import
            </span>
          </div>
        )}

        {/* Upload progress */}
        {uploads.map((u) => (
          <div key={u.name} className="rounded-lg border border-blue-500/20 bg-[#0c152d]/60 px-2.5 py-2">
            <div className="flex items-center gap-1.5">
              <Loader2 size={9} className="animate-spin text-blue-400 shrink-0" />
              <span className="truncate text-[9px] font-semibold text-neutral-300">{u.name}</span>
              <span className="ml-auto font-mono text-[8px] text-blue-400">{u.pct}%</span>
            </div>
            <div className="mt-1.5 h-0.5 overflow-hidden rounded-full bg-white/5">
              <div className="h-full bg-blue-500 transition-all" style={{ width: `${u.pct}%` }} />
            </div>
          </div>
        ))}
        {uploadError && (
          <p className="rounded-lg border border-red-500/20 bg-red-950/30 px-2.5 py-2 text-[9px] text-red-400">
            {uploadError}
          </p>
        )}

        {/* Scene clips */}
        <section>
          <p className="mb-2 flex items-center gap-1.5 text-[9px] font-bold font-mono uppercase tracking-wider text-neutral-500">
            <Clapperboard size={10} className="text-blue-400" /> Generated Scenes
          </p>
          {sceneClips.length === 0 ? (
            <p className="rounded-lg border border-dashed border-white/10 p-3 text-center text-[9px] text-neutral-600">
              No rendered scenes yet
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {sceneClips.map((clip) => (
                <div
                  key={clip.url}
                  {...dragProps({ kind: "video", url: clip.url, label: clip.label, duration: 10 })}
                  className="group relative aspect-video cursor-grab overflow-hidden rounded-lg border border-white/5 bg-[#0c152d] hover:border-blue-500/50 transition-colors active:cursor-grabbing"
                >
                  <video
                    src={clip.url}
                    muted
                    playsInline
                    preload="metadata"
                    className="pointer-events-none h-full w-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                  />
                  <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1 py-0.5 text-[7px] font-bold font-mono uppercase text-white">
                    {clip.label}
                  </span>
                  <button
                    title={`Add ${clip.label} at playhead`}
                    onClick={() => void addToTimeline({ kind: "video", url: clip.url, label: clip.label, duration: 10 })}
                    className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white opacity-0 shadow group-hover:opacity-100 hover:bg-blue-500 transition-all"
                  >
                    <Plus size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Compiled legacy film */}
        {project?.compileVideoUrl && (
          <section>
            <p className="mb-2 flex items-center gap-1.5 text-[9px] font-bold font-mono uppercase tracking-wider text-neutral-500">
              <Film size={10} className="text-emerald-400" /> Compiled Film
            </p>
            <div
              {...dragProps({ kind: "video", url: project.compileVideoUrl, label: "Compiled Film" })}
              className="group relative aspect-video cursor-grab overflow-hidden rounded-lg border border-white/5 bg-[#0c152d] hover:border-emerald-500/50 transition-colors active:cursor-grabbing"
            >
              <video
                src={project.compileVideoUrl}
                muted
                playsInline
                preload="metadata"
                className="pointer-events-none h-full w-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
              />
              <button
                title="Add compiled film at playhead"
                onClick={() => void addToTimeline({ kind: "video", url: project.compileVideoUrl, label: "Compiled Film" })}
                className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white opacity-0 shadow group-hover:opacity-100 hover:bg-emerald-500 transition-all"
              >
                <Plus size={11} />
              </button>
            </div>
          </section>
        )}

        {/* Uploaded video / images */}
        <section>
          <p className="mb-2 flex items-center gap-1.5 text-[9px] font-bold font-mono uppercase tracking-wider text-neutral-500">
            <ImageIcon size={10} className="text-purple-400" /> Project Media
          </p>
          {visualMedia.length === 0 ? (
            <button
              onClick={() => setImportOpen(true)}
              className="w-full rounded-lg border border-dashed border-white/10 p-3 text-center text-[9px] text-neutral-600 hover:border-purple-500/40 hover:text-neutral-400 transition-colors"
            >
              Drop videos or images here, or click to import
            </button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {visualMedia.map((m) => (
                <div
                  key={m.id}
                  {...dragProps(m)}
                  className="group relative aspect-video cursor-grab overflow-hidden rounded-lg border border-white/5 bg-[#0c152d] hover:border-purple-500/50 transition-colors active:cursor-grabbing"
                >
                  {m.kind === "video" ? (
                    <video
                      src={m.url}
                      muted
                      playsInline
                      preload="metadata"
                      className="pointer-events-none h-full w-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                    />
                  ) : (
                    <img
                      src={m.url}
                      alt={m.label}
                      className="pointer-events-none h-full w-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                    />
                  )}
                  <span className="absolute bottom-1 left-1 max-w-[85%] truncate rounded bg-black/70 px-1 py-0.5 text-[7px] font-bold font-mono uppercase text-white">
                    {m.label || m.kind}
                  </span>
                  <button
                    title={`Add ${m.label ?? m.kind} at playhead`}
                    onClick={() => void addToTimeline(m)}
                    className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-purple-600 text-white opacity-0 shadow group-hover:opacity-100 hover:bg-purple-500 transition-all"
                  >
                    <Plus size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Audio */}
        <section>
          <p className="mb-2 flex items-center gap-1.5 text-[9px] font-bold font-mono uppercase tracking-wider text-neutral-500">
            <Music size={10} className="text-emerald-400" /> Audio & Soundtracks
          </p>
          <div className="space-y-1.5">
            {audioMedia.length === 0 && !project?.musicUrl && (
              <button
                onClick={() => setImportOpen(true)}
                className="w-full rounded-lg border border-dashed border-white/10 p-3 text-center text-[9px] text-neutral-600 hover:border-emerald-500/40 hover:text-neutral-400 transition-colors"
              >
                Drop soundtracks or voiceovers here, or click to import
              </button>
            )}
            {audioMedia.map((m) => (
              <div
                key={m.id}
                {...dragProps(m)}
                className="group flex cursor-grab items-center justify-between gap-1.5 rounded-lg border border-white/5 bg-[#0c152d]/60 px-2.5 py-2 hover:border-emerald-500/40 transition-colors active:cursor-grabbing"
              >
                <Music size={10} className="shrink-0 text-emerald-500/70" />
                <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-neutral-300">{m.label || "Audio"}</span>
                {m.duration !== undefined && (
                  <span className="shrink-0 font-mono text-[8px] text-neutral-600">{Math.round(m.duration)}s</span>
                )}
                <button
                  title={`Add ${m.label ?? "audio"} at playhead`}
                  onClick={() => void addToTimeline(m)}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/5 text-neutral-400 opacity-0 group-hover:opacity-100 hover:bg-emerald-600 hover:text-white transition-all"
                >
                  <Plus size={11} />
                </button>
              </div>
            ))}
            {project?.musicUrl && !audioMedia.some((m) => m.url === project.musicUrl) && (
              <div
                {...dragProps({ kind: "audio", url: project.musicUrl, label: "Project Music" })}
                className="group flex cursor-grab items-center justify-between gap-1.5 rounded-lg border border-white/5 bg-[#0c152d]/60 px-2.5 py-2 hover:border-emerald-500/40 transition-colors active:cursor-grabbing"
              >
                <Music size={10} className="shrink-0 text-emerald-500/70" />
                <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-neutral-300">Project Music</span>
                <button
                  title="Add project music at playhead"
                  onClick={() => void addToTimeline({ kind: "audio", url: project.musicUrl, label: "Project Music" })}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/5 text-neutral-400 opacity-0 group-hover:opacity-100 hover:bg-emerald-600 hover:text-white transition-all"
                >
                  <Plus size={11} />
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Doc stats */}
        <section className="border-t border-white/5 pt-3">
          <div className="space-y-1 font-mono text-[8px] uppercase tracking-wider text-neutral-600">
            <div className="flex justify-between"><span>Canvas</span><span className="text-neutral-400">{doc.width}×{doc.height} @{doc.fps}fps</span></div>
            <div className="flex justify-between"><span>Tracks</span><span className="text-neutral-400">{doc.tracks.length}</span></div>
            <div className="flex justify-between"><span>Clips</span><span className="text-neutral-400">{doc.tracks.reduce((n, t) => n + t.clips.length, 0)}</span></div>
          </div>
        </section>
      </div>

      <ImportMediaModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        user={user}
        projectId={project?.id ?? null}
        existingUrls={library.map((m) => m.url)}
        onUploadFiles={(files) => void uploadFiles(files)}
        uploads={uploads}
      />
    </aside>
  );
}
