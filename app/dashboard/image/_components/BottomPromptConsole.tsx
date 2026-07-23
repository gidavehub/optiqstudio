"use client";

import React, { useRef, useState } from "react";
import { ImagePlus, Loader2, Plus, UploadCloud, Wand2, X } from "lucide-react";
import { AttachedImage } from "./types";

interface BottomPromptConsoleProps {
  prompt: string;
  setPrompt: (v: string) => void;
  enhance: () => void;
  enhancing: boolean;
  generating: boolean;
  onGenerate: () => void;
  images: AttachedImage[];
  attachImage: (file: File) => void;
  removeImage: (id: string) => void;
  onOpenAssetPicker: () => void;
}

// Image Studio's prompt dock — same silhouette as Video's console, trimmed to
// what image generation needs: reference-image attach, compose, enhance, go.
export default function BottomPromptConsole({
  prompt,
  setPrompt,
  enhance,
  enhancing,
  generating,
  onGenerate,
  images,
  attachImage,
  removeImage,
  onOpenAssetPicker,
}: BottomPromptConsoleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (dragCounter.current === 1) setIsDragging(true);
  };
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    Array.from(e.dataTransfer.files || [])
      .filter((f) => f.type.startsWith("image/"))
      .forEach(attachImage);
  };

  return (
    <div className="relative z-40 border-t border-neutral-900 bg-background/90 p-5 backdrop-blur-md">
      {images.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          {images.map((img) => (
            <div key={img.id} className="group relative flex items-center gap-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.preview} alt="Reference" className="h-14 w-14 rounded-lg border border-neutral-800 object-cover" />
              <button
                onClick={() => removeImage(img.id)}
                className="absolute -right-1.5 -top-1.5 rounded-full border border-neutral-800 bg-neutral-900/90 p-0.5 text-neutral-400 opacity-0 transition-opacity hover:text-white group-hover:opacity-100"
              >
                <X size={10} />
              </button>
            </div>
          ))}
          <span className="text-xs text-neutral-500">
            {images.length} reference image{images.length > 1 ? "s" : ""} attached
          </span>
        </div>
      )}

      <div
        className="relative flex w-full items-center gap-3 rounded-2xl border border-neutral-800 bg-surface p-3 shadow-inner transition-all duration-300"
        onDragEnter={handleDragEnter}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/30 bg-black/85 backdrop-blur-sm transition-all duration-300">
            <UploadCloud size={24} className="animate-pulse text-white" />
            <span className="mt-2 font-mono text-xs uppercase tracking-widest text-white">Drop image</span>
            <span className="mt-1 text-[10px] text-neutral-500">Use as a style / composition reference</span>
          </div>
        )}

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={onOpenAssetPicker}
            className="p-1.5 text-neutral-400 transition-colors hover:text-white"
            title="Open Asset Composer"
          >
            <Plus size={17} />
          </button>
          <label className="cursor-pointer p-1.5 text-neutral-400 transition-colors hover:text-white" title="Attach reference image">
            <ImagePlus size={17} />
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                Array.from(e.target.files || []).forEach(attachImage);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        <textarea
          rows={1}
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${e.target.scrollHeight}px`;
          }}
          placeholder="A bioluminescent jellyfish drifting through a deep-sea trench, cinematic, 8k…"
          className="max-h-32 flex-1 resize-none overflow-y-auto bg-transparent py-1 text-sm placeholder:text-neutral-600 focus:outline-none"
        />

        <button
          onClick={enhance}
          disabled={enhancing || !prompt.trim()}
          title="Enhance prompt"
          className="p-1.5 text-neutral-400 transition-colors hover:text-white disabled:opacity-40"
        >
          {enhancing ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
        </button>

        <button
          onClick={onGenerate}
          disabled={generating || !prompt.trim()}
          className="shrink-0 rounded-full bg-white px-5 py-2 text-sm font-medium text-black transition-colors hover:bg-neutral-200 disabled:opacity-40"
        >
          {generating ? "Generating…" : "Generate"}
        </button>
      </div>
    </div>
  );
}
