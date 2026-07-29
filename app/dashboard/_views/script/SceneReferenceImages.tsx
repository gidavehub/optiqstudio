"use client";

// SceneReferenceImages — the product/brand/character stills that ride along with
// a scene's render. Shared by the desktop card and the mobile deck.

import React from "react";
import { Plus, X } from "lucide-react";
import { SceneImage } from "../../_flow/types";

interface SceneReferenceImagesProps {
  sceneIndex: number;
  attached: SceneImage[];
  /** Project-level materials not yet on this scene — one tap to attach. */
  available: SceneImage[];
  onUpload: (files: FileList) => void;
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
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-3.5">
      <span className="text-[9px] font-bold uppercase tracking-wide text-neutral-500">
        Reference images — attached to this scene&apos;s render
      </span>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {attached.map((img, imgIdx) => (
          <div
            key={`${img.path}-${imgIdx}`}
            className="group relative h-14 w-14 overflow-hidden rounded-xl border border-white/10 bg-black"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt={img.name} className="h-full w-full object-cover" />
            <button
              onClick={() => onRemove(imgIdx)}
              title="Remove from this scene"
              className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-neutral-300 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
            >
              <X size={10} />
            </button>
          </div>
        ))}

        <label
          title="Upload a new reference image"
          className="flex h-14 w-14 cursor-pointer items-center justify-center rounded-xl border border-dashed border-white/15 text-neutral-500 transition-colors hover:border-blue-500/50 hover:text-blue-400"
        >
          <Plus size={15} />
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) onUpload(e.target.files);
              e.target.value = "";
            }}
          />
        </label>

        {available.map((mat) => (
          <button
            key={mat.path}
            onClick={() => onAttach(mat)}
            title={`Attach ${mat.name}`}
            className="relative h-14 w-14 overflow-hidden rounded-xl border border-white/5 opacity-40 transition-all hover:border-blue-500/50 hover:opacity-100"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mat.url} alt={mat.name} className="h-full w-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/40">
              <Plus size={13} className="text-white" />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
