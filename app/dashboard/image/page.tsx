"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Image as ImageIcon,
  Loader2,
  Sparkles,
  Download,
  Maximize2,
  Trash2,
  Check,
  Zap,
  UploadCloud,
  Plus,
  X,
} from "lucide-react";
import { useAuth } from "../../../components/AuthProvider";
import ConfirmGenerationModal from "../../../components/ConfirmGenerationModal";
import AssetPickerModal from "../../../components/AssetPickerModal";

interface GenerationItem {
  id: string;
  status: string;
  prompt: string;
  imageUrl: string;
  createdAt: string;
  cost?: number;
}

const ASPECTS = [
  { id: "1:1", label: "Square", desc: "1:1 · Social, avatars", iconClass: "w-4 h-4" },
  { id: "16:9", label: "Widescreen", desc: "16:9 · Landscape, Cinematic", iconClass: "w-6 h-3.5" },
  { id: "9:16", label: "Portrait", desc: "9:16 · Mobile, Stories", iconClass: "w-3.5 h-6" },
  { id: "4:3", label: "Standard", desc: "4:3 · Classic Photography", iconClass: "w-5 h-4" },
  { id: "3:4", label: "Vertical", desc: "3:4 · Editorial, Posters", iconClass: "w-4 h-5" },
];

export default function ImageStudioPage() {
  const { apiFetch, profile, pricing, refreshProfile } = useAuth();
  const searchParams = useSearchParams();

  // Settings states
  const [prompt, setPrompt] = useState(searchParams.get("prompt") ?? "");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [history, setHistory] = useState<GenerationItem[]>([]);
  const [activeItem, setActiveItem] = useState<GenerationItem | null>(null);
  
  // Status states
  const [generating, setGenerating] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);

  // Reference images attachment state
  const [images, setImages] = useState<{ id: string; base64: string; mimeType: string; preview: string }[]>([]);

  // Drag and drop states and counters
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (dragCounter.current === 1) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []);
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    imageFiles.forEach((file) => attachImage(file));
  };

  const attachImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      setImages((prev) => [
        ...prev,
        { id: Math.random().toString(36).substring(2, 9), base64, mimeType: file.type, preview: dataUrl }
      ]);
    };
    reader.readAsDataURL(file);
  };

  // Cost dynamic deduction
  const generationCost = pricing?.costs?.image ?? 50;
  const userBalance = profile?.credits ?? 0;

  // Fetch image generation history
  const loadHistory = useCallback(async () => {
    try {
      const data = await apiFetch<{ items: GenerationItem[] }>("/api/generations?type=image");
      const items = data.items || [];
      setHistory(items);
      if (items.length > 0 && !activeItem) {
        setActiveItem(items[0]);
      }
    } catch (err) {
      console.error("Failed to load image generations:", err);
    }
  }, [apiFetch, activeItem]);

  useEffect(() => {
    loadHistory();
  }, []);

  // Delete a specific image generation
  const deleteGeneration = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await apiFetch(`/api/generations?id=${id}`, {
        method: "DELETE"
      });
      setHistory((prev) => prev.filter((item) => item.id !== id));
      setActiveItem((prev) => {
        if (prev?.id === id) {
          const remaining = history.filter((item) => item.id !== id);
          return remaining.length > 0 ? remaining[0] : null;
        }
        return prev;
      });
      void refreshProfile();
    } catch {
      // Optimistic delete
      setHistory((prev) => prev.filter((item) => item.id !== id));
      setActiveItem((prev) => {
        if (prev?.id === id) {
          const remaining = history.filter((item) => item.id !== id);
          return remaining.length > 0 ? remaining[0] : null;
        }
        return prev;
      });
    }
  };

  // Enhance prompt with AI
  const handleEnhance = async () => {
    if (!prompt.trim()) return;
    setEnhancing(true);
    setError(null);
    try {
      const data = await apiFetch<{ prompt: string }>("/api/enhance", {
        method: "POST",
        body: JSON.stringify({ prompt }),
      });
      setPrompt(data.prompt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enhance failed");
    } finally {
      setEnhancing(false);
    }
  };

  // Launch actual generate call after modal confirmation
  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await apiFetch<{ id: string; url: string; mimeType: string; cost: number }>(
        "/api/image/generate",
        {
          method: "POST",
          body: JSON.stringify({
            prompt,
            aspectRatio,
            purpose: "image",
            referenceImages: images.map((img) => ({ base64: img.base64, mimeType: img.mimeType })),
          }),
        }
      );

      const newItem: GenerationItem = {
        id: res.id,
        status: "succeeded",
        prompt,
        imageUrl: res.url,
        createdAt: new Date().toISOString(),
        cost: res.cost,
      };

      setHistory((prev) => [newItem, ...prev]);
      setActiveItem(newItem);
      setImages([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image generation failed");
    } finally {
      setGenerating(false);
    }
  };

  // Request generate confirmation
  const triggerGenerateWorkflow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setConfirmOpen(true);
  };

  return (
    <div className="h-full bg-black text-white overflow-y-auto">
      <div className="px-8 py-10 flex flex-col min-h-full w-full">
        
        {/* Header Title */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/10 border border-violet-500/20 text-violet-400">
              <ImageIcon size={20} />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Image Studio</h1>
              <p className="text-xs text-neutral-500 mt-0.5">
                Generate custom digital artwork, photos, and high-fidelity textures.
              </p>
            </div>
          </div>
          <div className="text-xs font-medium font-mono text-neutral-400 bg-neutral-900/60 rounded-full px-4 py-2 border border-white/5">
            Balance: <span className="text-white font-bold">{userBalance.toLocaleString()} cr</span>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-950 bg-red-950/20 px-4 py-3 text-xs text-red-400">
            {error}
          </div>
        )}

        {/* Studio Workspace Layout */}
        <div className="grid gap-8 lg:grid-cols-[400px_1fr] items-start">
          
          {/* Left Panel: Settings Form */}
          <form onSubmit={triggerGenerateWorkflow} className="space-y-6 bg-[#08080a] border border-neutral-900 rounded-2xl p-6">
            
            {/* Prompt input */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold font-mono text-neutral-400 uppercase tracking-widest">
                  Describe your image
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setAssetPickerOpen(true)}
                    disabled={generating}
                    className="flex items-center gap-1.5 text-[10px] font-bold font-mono text-violet-400 hover:text-violet-300 disabled:opacity-40 transition-colors"
                  >
                    <Plus size={11} />
                    Compose
                  </button>
                  <button
                    type="button"
                    onClick={handleEnhance}
                    disabled={enhancing || !prompt.trim() || generating}
                    className="flex items-center gap-1 text-[10px] font-bold font-mono text-violet-400 hover:text-violet-300 disabled:opacity-40 transition-colors"
                  >
                    {enhancing ? (
                      <Loader2 size={10} className="animate-spin" />
                    ) : (
                      <Sparkles size={10} />
                    )}
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
                      <img src={img.preview} alt="Reference" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => setImages((prev) => prev.filter((i) => i.id !== img.id))}
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
                      className={`flex w-full items-center justify-between rounded-xl border p-3 text-left transition-all ${
                        active
                          ? "border-violet-500/50 bg-violet-600/[0.05]"
                          : "border-neutral-900/80 bg-neutral-950/60 hover:border-neutral-800"
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
                        <div className="flex h-5 h-5 w-5 items-center justify-center rounded-full bg-violet-600">
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
              className="w-full rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-xs font-bold py-3 px-5 transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-600/10 disabled:opacity-40 disabled:pointer-events-none"
            >
              {generating ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  Generating Cinematic Stills...
                </>
              ) : (
                <>
                  <Zap size={12} />
                  Generate Image · {generationCost} Credits
                </>
              )}
            </button>

          </form>

          {/* Right Panel: Selected Image Workspace */}
          <div className="flex flex-col gap-6">
            
            <div className="relative rounded-2xl border border-neutral-900 bg-[#08080a] p-4 min-h-[400px] flex items-center justify-center">
              {generating ? (
                <div className="flex flex-col items-center gap-3 text-neutral-400 py-16 animate-pulse">
                  <div className="relative flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full border border-violet-500/20 w-12 h-12 animate-ping" />
                    <Loader2 size={24} className="animate-spin text-violet-500" />
                  </div>
                  <p className="text-xs font-mono tracking-wider uppercase mt-2">DREAMING ON VERTEX AI...</p>
                  <p className="text-[10px] text-neutral-600">This usually takes around 5-15 seconds</p>
                </div>
              ) : activeItem ? (
                <div className="relative group w-full h-full flex items-center justify-center">
                  
                  {/* Large preview image */}
                  <img
                    src={activeItem.imageUrl}
                    alt={activeItem.prompt}
                    className="max-h-[500px] object-contain rounded-xl shadow-2xl border border-neutral-950 bg-neutral-950"
                  />

                  {/* Actions Layer on hover */}
                  <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
                    <a
                      href={activeItem.imageUrl}
                      download={`optiq-${activeItem.id}.jpg`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center rounded-lg bg-black/80 border border-white/10 hover:bg-neutral-950 p-2.5 text-white transition-colors"
                      title="Download image"
                    >
                      <Download size={15} />
                    </a>
                    <button
                      onClick={(e) => deleteGeneration(activeItem.id, e)}
                      className="flex items-center justify-center rounded-lg bg-black/80 border border-white/10 hover:bg-red-950 p-2.5 text-neutral-400 hover:text-white transition-colors"
                      title="Delete image"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                </div>
              ) : (
                <div className="flex flex-col items-center gap-2.5 text-neutral-500 py-16">
                  <ImageIcon size={28} className="text-neutral-600" />
                  <p className="text-xs font-medium">Your Workspace is Empty</p>
                  <p className="text-[10px] text-neutral-600 max-w-xs text-center leading-relaxed">
                    Write a creative prompt on the left to start generating gorgeous imagery.
                  </p>
                </div>
              )}
            </div>

            {/* Prompt details drawer */}
            {activeItem && !generating && (
              <div className="rounded-xl border border-neutral-900 bg-neutral-950/40 p-4 space-y-2">
                <p className="text-[10px] font-bold font-mono text-neutral-500 uppercase tracking-widest">
                  PROMPT DETAILS
                </p>
                <p className="text-xs text-neutral-300 leading-relaxed font-sans font-medium select-all">
                  {activeItem.prompt}
                </p>
              </div>
            )}

          </div>

        </div>

        {/* History Gallery */}
        <div className="mt-12 border-t border-neutral-900 pt-10">
          <h2 className="text-xs font-bold font-mono text-neutral-400 uppercase tracking-widest mb-6">
            IMAGE GENERATION GALLERY ({history.length})
          </h2>

          {history.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
              {history.map((item) => {
                const isActive = activeItem?.id === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveItem(item)}
                    className={`relative aspect-square overflow-hidden rounded-xl border bg-neutral-950 transition-all text-left group ${
                      isActive ? "border-violet-500 ring-2 ring-violet-500/20 scale-[0.98]" : "border-neutral-900 hover:border-neutral-700"
                    }`}
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.prompt}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-2 text-[10px] text-neutral-300 leading-tight">
                      <div className="flex justify-end">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteGeneration(item.id, e);
                          }}
                          className="p-1.5 rounded-lg bg-black/60 hover:bg-red-950 border border-white/5 text-neutral-400 hover:text-white transition-colors"
                          title="Delete image"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                      <p className="line-clamp-2">{item.prompt}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-neutral-900 bg-neutral-950/30 p-10 text-center text-neutral-500 text-xs font-mono uppercase tracking-wider">
              No previous generations found. Start creating!
            </div>
          )}
        </div>

      </div>

      {/* Confirm Pay Modal */}
      <ConfirmGenerationModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleGenerate}
        cost={generationCost}
        balance={userBalance}
        title="Confirm Image Generation"
        description="You are about to launch a high-fidelity image generation using Gemini-3.1-Flash model."
        actionLabel="Generate Image"
      />

      {/* Asset Picker Modal */}
      <AssetPickerModal
        isOpen={assetPickerOpen}
        onClose={() => setAssetPickerOpen(false)}
        onSelectCharacter={(character) => {
          setPrompt((prev) => {
            const charPrompt = `[Character: ${character.name}${character.imageDescription ? ` - ${character.imageDescription}` : ""}]`;
            return prev ? `${prev}\n${charPrompt}` : charPrompt;
          });

          if (character.imageUrl) {
            setError(null);
            fetch(character.imageUrl)
              .then((res) => res.blob())
              .then((blob) => {
                const reader = new FileReader();
                reader.onload = () => {
                  const dataUrl = reader.result as string;
                  setImages((prev) => [
                    ...prev,
                    {
                      id: Math.random().toString(36).substring(2, 9),
                      base64: dataUrl.split(",")[1],
                      mimeType: blob.type || "image/png",
                      preview: dataUrl,
                    }
                  ]);
                };
                reader.readAsDataURL(blob);
              })
              .catch(() => {
                setError("Failed to convert character portrait for consistency");
              });
          }
        }}
        onSelectTrait={(trait) => {
          setPrompt((prev) => (prev ? `${prev}, ${trait}` : trait));
        }}
        onUploadFile={(file) => {
          attachImage(file);
        }}
        allowedUploadTypes="image/*"
      />

    </div>
  );
}
