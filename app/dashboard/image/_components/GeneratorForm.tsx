"use client";

import React, { useRef, useState } from "react";
import { Check, Image as ImageIcon, Loader2, Plus, Trash2, UploadCloud, Wand2, Zap } from "lucide-react";
import { ASPECTS, AttachedImage } from "./types";

interface GeneratorFormProps {
  prompt: string;
  setPrompt: (v: string) => void;
  aspectRatio: string;
  setAspectRatio: (v: string) => void;
  images: AttachedImage[];
  attachImage: (file: File) => void;
  removeImage: (id: string) => void;
  generating: boolean;
  enhancing: boolean;
  onEnhance: () => void;
  onOpenAssetPicker: () => void;
  onSubmit: (e: React.FormEvent) => void;
  generationCost: number;
}

export default function GeneratorForm({
  prompt,
  setPrompt,
  aspectRatio,
  setAspectRatio,
  images,
  attachImage,
  removeImage,
  generating,
  enhancing,
  onEnhance,
  onOpenAssetPicker,
  onSubmit,
  generationCost,
}: GeneratorFormProps) {
  // Drag and drop state (local to the reference-images block)
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
    const files = Array.from(e.dataTransfer.files || []);
    files.filter((file) => file.type.startsWith("image/")).forEach((file) => attachImage(file));
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6 bg-surface border border-neutral-900 rounded-2xl p-6">
      {/* Prompt input */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <label className="text-xs font-bold font-mono text-neutral-400 uppercase tracking-widest">
            Describe your image
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onOpenAssetPicker}
              disabled={generating}
              className="flex items-center gap-1.5 text-[10px] font-bold font-mono text-neutral-400 hover:text-white disabled:opacity-40 transition-colors"
            >
              <Plus size={11} />
              Compose
            </button>
            <button
              type="button"
              onClick={onEnhance}
              disabled={enhancing || !prompt.trim() || generating}
              className="flex items-center gap-1 text-[10px] font-bold font-mono text-neutral-400 hover:text-white disabled:opacity-40 transition-colors"
            >
              {enhancing ? <Loader2 size={10} className="animate-spin" /> : <Wand2 size={10} />}
              Enhance
            </button>
          </div>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="A cinematic macro shot of a bioluminescent jellyfish floating in a dark deep sea trench, detailed coral background, octane render, 8k resolution..."
          rows={5}
          disabled={generating}
          className="w-full text-xs rounded-xl bg-neutral-950 border border-neutral-900/80 p-3.5 placeholder:text-neutral-600 focus:border-white/20 focus:ring-0 focus:outline-none resize-none leading-relaxed transition-colors text-white"
        />
      </div>

      {/* Reference Image Attachment (Optional) */}
      <div
        className="relative space-y-2 rounded-xl transition-all duration-300"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <label className="text-xs font-bold font-mono text-neutral-400 uppercase tracking-widest block">
          Reference Images (Optional)
        </label>

        {images.length === 0 ? (
          <label className="flex flex-col items-center justify-center border border-dashed border-neutral-900 bg-neutral-950/40 rounded-xl p-5 hover:border-neutral-800 hover:bg-neutral-950/60 transition-all cursor-pointer group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-neutral-900 border border-white/5 text-neutral-500 group-hover:text-white transition-colors mb-2">
              <ImageIcon size={14} />
            </div>
            <span className="text-[11px] font-medium text-neutral-400 group-hover:text-neutral-200 transition-colors">Attach reference image</span>
            <span className="text-[9px] text-neutral-600 mt-0.5">Supports PNG, JPG, WEBP</span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                files.forEach((file) => attachImage(file));
              }}
              className="hidden"
            />
          </label>
        ) : (
          <div className="grid grid-cols-4 gap-3 bg-neutral-950/40 border border-neutral-900 rounded-xl p-3">
            {images.map((img) => (
              <div key={img.id} className="relative group aspect-square rounded-lg overflow-hidden border border-neutral-800 bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.preview} alt="Reference" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeImage(img.id)}
                  className="absolute top-1 right-1 bg-black/80 hover:bg-red-600/90 text-neutral-400 hover:text-white rounded-md p-1 border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                  title="Remove image"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
            <label className="flex flex-col items-center justify-center border border-dashed border-neutral-800 bg-neutral-950/20 hover:bg-neutral-950/50 hover:border-neutral-700 rounded-lg aspect-square cursor-pointer group transition-all">
              <Plus size={14} className="text-neutral-500 group-hover:text-neutral-300 transition-colors" />
              <span className="text-[9px] text-neutral-500 mt-1">Add</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  files.forEach((file) => attachImage(file));
                }}
                className="hidden"
              />
            </label>
          </div>
        )}

        {/* Gorgeous Drop Overlay for Image Studio */}
        {isDragging && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-xl border border-dashed border-white/30 bg-black/85 backdrop-blur-sm pointer-events-none transition-all duration-300">
            <UploadCloud size={24} className="text-white animate-pulse animate-bounce-subtle" />
            <span className="text-xs font-mono tracking-widest text-white mt-2 uppercase">Drop Image</span>
            <span className="text-[9px] text-neutral-500 mt-0.5">To use as style/composition reference</span>
          </div>
        )}
      </div>

      {/* Aspect Ratio Selector */}
      <div className="space-y-2.5">
        <label className="text-xs font-bold font-mono text-neutral-400 uppercase tracking-widest block">
          Aspect Ratio
        </label>
        <div className="space-y-2">
          {ASPECTS.map((aspect) => {
            const active = aspectRatio === aspect.id;
            return (
              <button
                key={aspect.id}
                type="button"
                onClick={() => setAspectRatio(aspect.id)}
                disabled={generating}
                className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition-all duration-300 ${
                  active
                    ? "border-blue-500 bg-[#0c152d] text-white"
                    : "border-white/5 bg-neutral-950/60 hover:border-white/10 hover:bg-[#131d35]"
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Aspect visual outline box */}
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-neutral-900 border border-white/5 shrink-0">
                    <div className={`border border-neutral-400 rounded-sm opacity-60 ${aspect.iconClass}`} />
                  </div>
                  <div>
                    <span className="block text-xs font-semibold text-white">{aspect.label}</span>
                    <span className="block text-[10px] text-neutral-500 mt-0.5">{aspect.desc}</span>
                  </div>
                </div>
                {active && (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-white shadow-md shadow-blue-500/30 ring-2 ring-blue-500/20 animate-scaleUp">
                    <Check size={10} className="text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={generating || !prompt.trim()}
        className="w-full rounded-full bg-white hover:bg-neutral-200 text-black text-xs font-bold py-3 px-5 transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-40 disabled:pointer-events-none"
      >
        {generating ? (
          <>
            <Loader2 size={13} className="animate-spin" />
            Generating Cinematic Stills...
          </>
        ) : (
          <>
            <Zap size={12} />
            Generate Image · GMD {generationCost}.00
          </>
        )}
      </button>
    </form>
  );
}
