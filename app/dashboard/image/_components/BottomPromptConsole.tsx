"use client";

import React, { useRef, useState } from "react";
import { ImagePlus, Loader2, Mic, MicOff, UploadCloud, Wand2, X } from "lucide-react";
import { useDictation } from "../../_shared/useDictation";
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
}: BottomPromptConsoleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  // Live speech-to-text, same pipeline as the storyboard wizard's mic.
  const dictation = useDictation((updater) => setPrompt(updater(prompt)));

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
    <div className="relative z-40 border-t border-line bg-background/90 p-5 backdrop-blur-md">
      {images.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          {images.map((img) => (
            <div key={img.id} className="group relative flex items-center gap-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.preview} alt="Reference" className="h-14 w-14 rounded-xl border border-line object-cover" />
              <button
                onClick={() => removeImage(img.id)}
                className="absolute -right-1.5 -top-1.5 rounded-full border border-line bg-surface p-0.5 text-ink-3 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
              >
                <X size={10} />
              </button>
            </div>
          ))}
          <span className="text-xs text-muted">
            {images.length} reference image{images.length > 1 ? "s" : ""} attached
          </span>
        </div>
      )}

      <div
        className="relative flex w-full items-center gap-3 rounded-3xl border border-line bg-surface p-3 shadow-inner transition-all duration-300"
        onDragEnter={handleDragEnter}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="pointer-events-none absolute inset-0 z-50 flex flex-col items-center justify-center rounded-3xl border border-dashed border-line-2 bg-black/85 backdrop-blur-sm transition-all duration-300">
            <UploadCloud size={24} className="animate-pulse text-foreground" />
            <span className="mt-2 font-mono text-xs uppercase tracking-widest text-foreground">Drop image</span>
            <span className="mt-1 text-[10px] text-muted">Use as a style / composition reference</span>
          </div>
        )}

        <div className="flex shrink-0 items-center gap-1.5">
          <label className="cursor-pointer p-1.5 text-ink-3 transition-colors hover:text-foreground" title="Attach reference image">
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
          <button
            type="button"
            onClick={dictation.toggle}
            title={dictation.recording ? "Stop dictation" : "Dictate your prompt"}
            className={`rounded-full p-1.5 transition-colors ${
              dictation.recording
                ? "animate-pulse bg-danger-soft text-danger"
                : "text-ink-3 hover:text-white"
            }`}
          >
            {dictation.recording ? <MicOff size={17} /> : <Mic size={17} />}
          </button>
        </div>

        <textarea
          rows={1}
          value={dictation.recording && dictation.interim ? `${prompt} ${dictation.interim}`.trim() : prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${e.target.scrollHeight}px`;
          }}
          readOnly={dictation.recording}
          placeholder={
            dictation.recording
              ? "Listening…"
              : "A bioluminescent jellyfish drifting through a deep-sea trench, cinematic, 8k…"
          }
          className="max-h-32 flex-1 resize-none overflow-y-auto bg-transparent py-1 text-sm placeholder:text-faint focus:outline-none"
        />

        <button
          onClick={enhance}
          disabled={enhancing || !prompt.trim()}
          title="Enhance prompt"
          className="p-1.5 text-ink-3 transition-colors hover:text-foreground disabled:opacity-40"
        >
          {enhancing ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
        </button>

        <button
          onClick={onGenerate}
          disabled={generating || !prompt.trim()}
          className="shrink-0 rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-ink-2 disabled:opacity-40"
        >
          {generating ? "Generating…" : "Generate"}
        </button>
      </div>
    </div>
  );
}
