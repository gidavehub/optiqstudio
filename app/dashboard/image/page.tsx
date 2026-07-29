"use client";

// Image Studio — rebuilt one-for-one on the Video Studio layout: a minimal
// settings rail (aspect ratio), a wall of past stills in the centre, and a
// bottom prompt console. Clicking a still opens /dashboard/image/[id].

import React, { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { useAuth } from "../../../components/AuthProvider";
import ConfirmGenerationModal from "../../../components/ConfirmGenerationModal";
import SettingsRail from "./_components/SettingsRail";
import StudioProjectsGrid from "../_shared/StudioProjectsGrid";
import AspectRatioStrip from "../_shared/AspectRatioStrip";
import { IMAGE_ASPECTS } from "../_shared/aspectOptions";
import BottomPromptConsole from "./_components/BottomPromptConsole";
import { useGenerationHistory } from "../_shared/useGenerationHistory";
import { useReusePrompt } from "../_shared/useReusePrompt";
import { takePromptHandoff } from "../_shared/promptHandoff";
import { AttachedImage, GenerationItem } from "./_components/types";

function ImageWorkspace() {
  const { apiFetch, profile, pricing } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [prompt, setPrompt] = useState(searchParams.get("prompt") ?? "");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [images, setImages] = useState<AttachedImage[]>([]);

  const [generating, setGenerating] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [openedMenuId, setOpenedMenuId] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const reusePrompt = useReusePrompt();

  // The server is the only thing that charges; this is purely what we quote.
  const generationCost = pricing?.costs.image ?? 10;
  const userBalance = profile?.credits ?? 0;

  const fetchImages = useCallback(
    () => apiFetch<{ items: GenerationItem[] }>("/api/generations?type=image").then((d) => d.items || []),
    [apiFetch]
  );
  const { history, freshIds, addOptimistic, resolveOptimistic, removeItem } =
    useGenerationHistory<GenerationItem>({ fetcher: fetchImages });

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

  // Click-away for the ⋮ popover menu.
  useEffect(() => {
    const close = () => setOpenedMenuId(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);

  // Picks up a "reuse prompt" sent from a detail page — text plus the reference
  // images, which a query string can't carry. Reading sessionStorage is exactly
  // the "pull once from an external system on mount" case; it can't move into a
  // lazy initializer because sessionStorage doesn't exist during SSR and the two
  // renders would disagree.
  useEffect(() => {
    const handoff = takePromptHandoff();
    if (!handoff) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrompt(handoff.prompt);
    setImages(handoff.images);
  }, []);

  const handleEnhance = async () => {
    if (!prompt.trim() || enhancing) return;
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

  const triggerGenerate = () => {
    if (!prompt.trim() || generating) return;
    setConfirmOpen(true);
  };

  const handleReuse = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenedMenuId(null);
    const reused = await reusePrompt(id);
    if (!reused) return;
    setPrompt(reused.prompt);
    setImages(reused.images);
  };

  // Drop an optimistic "generating" card instantly, then swap it for the real
  // still — matching the Video Studio flow one-for-one.
  const handleGenerate = async () => {
    if (!prompt.trim() || generating) return;
    setGenerating(true);
    setError(null);

    const tempId = `temp_${Date.now()}`;
    const originalPrompt = prompt;
    const refs = images.map((img) => ({ base64: img.base64, mimeType: img.mimeType }));

    addOptimistic({
      id: tempId,
      status: "rendering",
      prompt: originalPrompt,
      imageUrl: "",
      createdAt: new Date().toISOString(),
    } as GenerationItem);
    setPrompt("");
    setImages([]);

    try {
      const res = await apiFetch<{ id: string; url: string; mimeType: string; cost: number }>(
        "/api/image/generate",
        {
          method: "POST",
          body: JSON.stringify({ prompt: originalPrompt, aspectRatio, purpose: "image", referenceImages: refs }),
        }
      );
      resolveOptimistic(tempId, {
        id: res.id,
        status: "succeeded",
        imageUrl: res.url,
        cost: res.cost,
      } as Partial<GenerationItem>);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image generation failed");
      removeItem(tempId);
    } finally {
      setGenerating(false);
    }
  };

  // Fade the card out, then drop it; the API call runs in the background.
  const deleteGeneration = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenedMenuId(null);
    setDeletingIds((prev) => new Set(prev).add(id));

    void apiFetch(`/api/generations?id=${id}`, { method: "DELETE" }).catch(() => {});

    setTimeout(() => {
      removeItem(id);
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 320);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-black text-white sm:flex-row">
      <SettingsRail aspectRatio={aspectRatio} setAspectRatio={setAspectRatio} />

      <main className="relative flex flex-1 flex-col overflow-hidden bg-black">
        <div className="flex-1 min-h-0 overflow-y-auto p-4 pt-20 sm:p-6 sm:pt-24 md:p-8">
          <div className="mb-8 flex items-center justify-between border-b border-neutral-900 pb-4">
            <div>
              <span className="block font-mono text-[10px] font-bold uppercase tracking-widest text-neutral-500">
                CREATIVE FLOW
              </span>
              <h2 className="mt-1 text-[18px] font-bold tracking-tight text-white">All Stills &amp; Artwork</h2>
            </div>
          </div>

          <StudioProjectsGrid
            items={history.map((h) => ({
              id: h.id,
              status: h.status,
              prompt: h.prompt,
              mediaUrl: h.imageUrl || null,
              createdAt: h.createdAt,
            }))}
            mediaType="image"
            openedMenuId={openedMenuId}
            setOpenedMenuId={setOpenedMenuId}
            deletingIds={deletingIds}
            freshIds={freshIds}
            onOpen={(item) => {
              if (!item.id.startsWith("temp_")) router.push(`/dashboard/image/${item.id}`);
            }}
            onDelete={(id, e) => deleteGeneration(id, e)}
            onReuse={(id, e) => void handleReuse(id, e)}
            emptyTitle="No stills generated yet"
            emptyHint="Describe an image below and watch it appear on the wall."
          />
        </div>

        {error && (
          <div className="mx-8 mb-4 flex animate-rise items-center justify-between rounded-xl border border-red-950 bg-red-950/40 p-4 text-xs text-red-300">
            <span>Error: {error}</span>
            <button onClick={() => setError(null)} className="text-neutral-500 hover:text-white">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Mobile-only compact settings — desktop uses the left rail */}
        <div className="border-t border-neutral-900 bg-background/90 px-4 py-2.5 backdrop-blur-md sm:hidden">
          <AspectRatioStrip options={IMAGE_ASPECTS} value={aspectRatio} onChange={setAspectRatio} />
        </div>

        <BottomPromptConsole
          prompt={prompt}
          setPrompt={setPrompt}
          enhance={() => void handleEnhance()}
          enhancing={enhancing}
          generating={generating}
          onGenerate={triggerGenerate}
          images={images}
          attachImage={attachImage}
          removeImage={(id) => setImages((prev) => prev.filter((i) => i.id !== id))}
        />
      </main>

      <ConfirmGenerationModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void handleGenerate()}
        cost={generationCost}
        balance={userBalance}
        title="Confirm Image Generation"
        description="High-fidelity image generation"
        actionLabel="Generate Image"
      />
    </div>
  );
}

export default function ImageStudioPage() {
  return (
    <Suspense>
      <ImageWorkspace />
    </Suspense>
  );
}
