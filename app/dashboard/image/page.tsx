"use client";

// Image Studio — thin page shell. State and API handlers live here; UI panels
// are split into ./_components (GeneratorForm, ImageWorkspacePanel, HistoryGallery).

import React, { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Image as ImageIcon } from "lucide-react";
import Link from "next/link";
import { useAuth } from "../../../components/AuthProvider";
import ConfirmGenerationModal from "../../../components/ConfirmGenerationModal";
import AssetPickerModal from "../../../components/AssetPickerModal";
import GeneratorForm from "./_components/GeneratorForm";
import ImageWorkspacePanel from "./_components/ImageWorkspacePanel";
import HistoryGallery from "./_components/HistoryGallery";
import { AttachedImage, GenerationItem } from "./_components/types";

export default function ImageStudioPage() {
  const { apiFetch, profile, refreshProfile } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

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
  const [images, setImages] = useState<AttachedImage[]>([]);

  const attachImage = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      setImages((prev) => [
        ...prev,
        { id: Math.random().toString(36).substring(2, 9), base64, mimeType: file.type, preview: dataUrl },
      ]);
    };
    reader.readAsDataURL(file);
  };

  // Cost dynamic deduction — Flat-rate GMD 100.00 as specified
  const generationCost = 100;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Delete a specific image generation
  const deleteGeneration = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await apiFetch(`/api/generations?id=${id}`, {
        method: "DELETE",
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
      <div className="px-4 sm:px-8 py-6 flex flex-col min-h-full w-full pt-20">
        {/* Back Button */}
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 text-[11px] font-bold font-mono text-neutral-500 hover:text-white transition-colors uppercase tracking-wider mb-6 group w-fit"
        >
          <ArrowLeft size={12} className="group-hover:-translate-x-0.5 transition-transform" />
          Back to Dashboard
        </Link>

        {/* Header Title */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-800 border border-neutral-700 text-neutral-300">
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
          <GeneratorForm
            prompt={prompt}
            setPrompt={setPrompt}
            aspectRatio={aspectRatio}
            setAspectRatio={setAspectRatio}
            images={images}
            attachImage={attachImage}
            removeImage={(id) => setImages((prev) => prev.filter((i) => i.id !== id))}
            generating={generating}
            enhancing={enhancing}
            onEnhance={() => void handleEnhance()}
            onOpenAssetPicker={() => setAssetPickerOpen(true)}
            onSubmit={triggerGenerateWorkflow}
            generationCost={generationCost}
          />

          {/* Right Panel: Selected Image Workspace */}
          <ImageWorkspacePanel
            generating={generating}
            activeItem={activeItem}
            onDelete={(id, e) => void deleteGeneration(id, e)}
          />
        </div>

        {/* History Gallery — cards open the dedicated detail route */}
        <HistoryGallery
          history={history}
          activeItem={activeItem}
          onSelect={(item) => router.push(`/dashboard/image/${item.id}`)}
          onDelete={(id, e) => void deleteGeneration(id, e)}
        />
      </div>

      {/* Confirm Pay Modal */}
      <ConfirmGenerationModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleGenerate}
        cost={generationCost}
        balance={userBalance}
        title="Confirm Image Generation"
        description="High-fidelity image generation"
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
                    },
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
