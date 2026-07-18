"use client";

import React, { useRef, useState } from "react";
import { ImagePlus, Loader2, Mic, Plus, UploadCloud, Wand2, X } from "lucide-react";
import AudioPlayerPreview from "./AudioPlayerPreview";
import { AttachedAudio, AttachedImage, AttachedVideo } from "./types";

interface BottomPromptConsoleProps {
  prompt: string;
  setPrompt: (v: string) => void;
  enhance: () => void;
  enhancing: boolean;
  phase: "idle" | "generating" | "done" | "failed";
  onGenerate: () => void;
  images: AttachedImage[];
  removeImage: (id: string) => void;
  videoFile: AttachedVideo | null;
  clearVideoFile: () => void;
  audioFile: AttachedAudio | null;
  clearAudioFile: () => void;
  onAttachMediaFiles: (files: File[]) => void;
  onAttachAudioFile: (file: File) => void;
  onDropFiles: (files: File[]) => void;
  onOpenAssetPicker: () => void;
}

export default function BottomPromptConsole({
  prompt,
  setPrompt,
  enhance,
  enhancing,
  phase,
  onGenerate,
  images,
  removeImage,
  videoFile,
  clearVideoFile,
  audioFile,
  clearAudioFile,
  onAttachMediaFiles,
  onAttachAudioFile,
  onDropFiles,
  onOpenAssetPicker,
}: BottomPromptConsoleProps) {
  // Drag and drop state (local to this console)
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
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    onDropFiles(Array.from(e.dataTransfer.files || []));
  };

  return (
    <div className="border-t border-neutral-900 p-5 bg-background/90 backdrop-blur-md relative z-40">
      {images.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-3">
          {images.map((img) => (
            <div key={img.id} className="relative group flex items-center gap-1.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.preview} alt="Reference" className="h-14 w-14 rounded-lg object-cover border border-neutral-800" />
              <button
                onClick={() => removeImage(img.id)}
                className="absolute -top-1.5 -right-1.5 bg-neutral-900/90 text-neutral-400 hover:text-white rounded-full p-0.5 border border-neutral-800 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={10} />
              </button>
            </div>
          ))}
          <span className="text-xs text-neutral-500">
            {images.length} Reference image{images.length > 1 ? "s" : ""} attached
          </span>
        </div>
      )}

      {videoFile && (
        <div className="mb-3 flex items-center gap-3">
          <video src={videoFile.preview} className="h-14 w-14 rounded-lg object-cover border border-neutral-800" muted playsInline />
          <button onClick={clearVideoFile} className="text-neutral-500 hover:text-white">
            <X size={14} />
          </button>
          <span className="text-xs text-neutral-500">Reference video attached</span>
        </div>
      )}

      {audioFile && (
        <div className="mb-3 flex items-center gap-3">
          <AudioPlayerPreview audio={audioFile} />
          <button onClick={clearAudioFile} className="text-neutral-500 hover:text-white">
            <X size={14} />
          </button>
          <span className="text-xs text-neutral-500">Voice reference attached</span>
        </div>
      )}

      <div
        className="relative flex items-center gap-3 rounded-2xl border border-neutral-800 bg-surface p-3 w-full shadow-inner transition-all duration-300"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Gorgeous Drop Overlay for Bottom Console */}
        {isDragging && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/30 bg-black/85 backdrop-blur-sm pointer-events-none transition-all duration-300">
            <UploadCloud size={24} className="text-white animate-pulse animate-bounce-subtle" />
            <span className="text-xs font-mono tracking-widest text-white mt-2 uppercase">Drop Image, Video or Audio</span>
            <span className="text-[10px] text-neutral-500 mt-1">To use as a visual reference or voice profile</span>
          </div>
        )}

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenAssetPicker}
            className="p-1.5 text-neutral-400 hover:text-white transition-colors"
            title="Open Asset Composer"
          >
            <Plus size={17} />
          </button>
          <label className="cursor-pointer p-1.5 text-neutral-400 hover:text-white transition-colors" title="Attach reference media (image/video)">
            <ImagePlus size={17} />
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (files.length === 0) return;
                onAttachMediaFiles(files);
              }}
            />
          </label>
          <label className="cursor-pointer p-1.5 text-neutral-400 hover:text-white transition-colors" title="Attach voice reference (audio)">
            <Mic size={17} />
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                onAttachAudioFile(file);
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
          placeholder="A slow dolly through a rain-soaked neon market at night…"
          className="flex-1 resize-none bg-transparent py-1 text-sm placeholder:text-neutral-600 max-h-32 overflow-y-auto focus:outline-none"
        />
        <button
          onClick={enhance}
          disabled={enhancing || !prompt.trim()}
          title="Enhance prompt"
          className="p-1.5 text-neutral-400 hover:text-white transition-colors disabled:opacity-40"
        >
          {enhancing ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
        </button>

        <button
          onClick={onGenerate}
          disabled={phase === "generating" || !prompt.trim()}
          className="rounded-full bg-white px-5 py-2 text-sm font-medium text-black hover:bg-neutral-200 transition-colors disabled:opacity-40 shrink-0"
        >
          {phase === "generating" ? "Generating…" : "Generate"}
        </button>
      </div>
    </div>
  );
}
