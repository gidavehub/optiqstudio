"use client";

// SceneReferenceImages — the product/brand/character stills that ride along with
// a scene's render. Shared by the desktop card and the mobile deck.
//
// The WHOLE card is a drop target, not a separate dashed rectangle bolted on
// beside it: a director dragging a product shot aims at the pictures, because
// that is where it is going. The + tile stays regardless — drag-and-drop cannot
// be performed on a phone and this card is used on one, so every action here has
// to be reachable by tap as well.

import React, { useRef, useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { SceneImage } from "../../_flow/types";

interface SceneReferenceImagesProps {
  sceneIndex: number;
  attached: SceneImage[];
  /** Project-level materials not yet on this scene — one tap to attach. */
  available: SceneImage[];
  /** Returning the upload's promise is what keeps the busy tile up for it. */
  onUpload: (files: FileList | File[]) => void | Promise<void>;
  onAttach: (material: SceneImage) => void;
  onRemove: (imageIndex: number) => void;
}

export default function SceneReferenceImages({
  attached,
  available,
  onUpload,
  onAttach,
  onRemove,
}: SceneReferenceImagesProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  // A dropped .mov or .pdf is refused out loud. Silently dropping it on the
  // floor is indistinguishable from a broken drop target.
  const [refused, setRefused] = useState(false);

  // Depth counter rather than a boolean: dragging across a child fires
  // dragleave on the parent, and a boolean flickers the highlight off while the
  // file is still over the card.
  const dragDepth = useRef(0);
  const endDrag = () => {
    dragDepth.current = 0;
    setDragging(false);
  };

  const takeFiles = async (list: FileList | File[] | null) => {
    const files = Array.from(list || []);
    if (files.length === 0) return;
    const images = files.filter((f) => f.type.startsWith("image/"));
    setRefused(images.length < files.length);
    if (images.length === 0) return;
    setUploading(true);
    try {
      await onUpload(images);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      onDragEnter={(e) => {
        // Dragging selected text across the card is not an upload.
        if (!Array.from(e.dataTransfer.types || []).includes("Files")) return;
        e.preventDefault();
        dragDepth.current += 1;
        setRefused(false);
        setDragging(true);
      }}
      onDragOver={(e) => {
        if (!dragging) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={() => {
        if (!dragging) return;
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) endDrag();
      }}
      onDrop={(e) => {
        if (!dragging) return;
        e.preventDefault();
        endDrag();
        void takeFiles(e.dataTransfer.files);
      }}
      className={`rounded-[28px] border p-3.5 transition-colors ${
        dragging ? "border-accent-line bg-surface-2" : "border-line bg-surface"
      }`}
    >
      <span className="text-[9px] font-bold uppercase tracking-wide text-muted">
        {dragging ? (
          <span className="text-accent-ink">Drop to attach to this scene</span>
        ) : refused ? (
          <span className="text-danger">Images only — the rest was skipped</span>
        ) : (
          <>Reference images — attached to this scene&apos;s render</>
        )}
      </span>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {attached.map((img, imgIdx) => (
          <div
            key={`${img.path}-${imgIdx}`}
            className="group relative h-14 w-14 overflow-hidden rounded-2xl border border-line bg-background"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt={img.name} className="h-full w-full object-cover" />
            <button
              onClick={() => onRemove(imgIdx)}
              title="Remove from this scene"
              className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-background/85 backdrop-blur-sm text-ink-2 opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
            >
              <X size={10} />
            </button>
          </div>
        ))}

        <label
          title={uploading ? "Uploading…" : "Upload a reference image, or drop one anywhere on this card"}
          className={`flex h-14 w-14 items-center justify-center rounded-2xl border border-dashed transition-colors ${
            uploading
              ? "cursor-wait border-accent-line text-accent-ink"
              : "cursor-pointer border-line-2 text-muted hover:border-accent-line hover:text-accent-ink"
          }`}
        >
          {uploading ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={uploading}
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) void takeFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>

        {available.map((mat) => (
          <button
            key={mat.path}
            onClick={() => onAttach(mat)}
            title={`Attach ${mat.name}`}
            className="relative h-14 w-14 overflow-hidden rounded-2xl border border-line opacity-40 transition-all hover:border-accent-line hover:opacity-100"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mat.url} alt={mat.name} className="h-full w-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center bg-background/55">
              <Plus size={13} className="text-foreground" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
