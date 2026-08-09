"use client";

// Image Studio — one-for-one with the Video Studio: the same floating island,
// the same bold rail, the same two-layer dock. Clicking a still opens
// /dashboard/image/[id].

import React, { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../../components/AuthProvider";
import ConfirmGenerationModal from "../../../components/ConfirmGenerationModal";
import StudioProjectsGrid from "../_shared/StudioProjectsGrid";
import { IMAGE_ASPECTS } from "../_shared/aspectOptions";
import StudioShell from "../_shell/StudioShell";
import StudioDock from "../_shell/StudioDock";
import DockAttachments from "../_shell/DockAttachments";
import { RailGroup, RailShapes, RailStat } from "../_shell/StudioRail";
import { STUDIO_NAV } from "../_shell/nav";
import { useDictation } from "../_shared/useDictation";
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
  // The mic is a dock tile now, not a glyph inside the input bar.
  const dictation = useDictation(setPrompt);

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
        body: JSON.stringify({ prompt, kind: "image" }),
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
      // Same reason as the video studio: shape the placeholder up front.
      aspectRatio,
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

  // The Shape tile cycles rather than opening a menu: one tap, one change,
  // and the tile itself always says which shape you're on.
  const shapeIndex = Math.max(0, IMAGE_ASPECTS.findIndex((a) => a.id === aspectRatio));
  const shape = IMAGE_ASPECTS[shapeIndex];
  const cycleShape = () => setAspectRatio(IMAGE_ASPECTS[(shapeIndex + 1) % IMAGE_ASPECTS.length].id);

  return (
    <StudioShell
      navItems={STUDIO_NAV}
      activeId="image"
      title="All stills"
      railLabel="Shape"
      onDropFiles={(files) => files.filter((f) => f.type.startsWith("image/")).forEach(attachImage)}
      dropHint="Drop a style or composition reference"
      rail={
        <>
          <RailGroup title="Shape" hint="Tap the one you want">
            <RailShapes options={IMAGE_ASPECTS} value={aspectRatio} onChange={setAspectRatio} />
          </RailGroup>
          <RailStat
            label="Per still"
            value={String(generationCost)}
            unit="GMD"
            note="Charged only when the image lands."
          />
        </>
      }
      dock={() => (
        <StudioDock
          tiles={[
            {
              id: "reference",
              label: "Reference",
              icon: "addMedia",
              badge: images.length,
              file: {
                accept: "image/*",
                multiple: true,
                onFiles: (files) => files.forEach(attachImage),
              },
            },
            {
              id: "dictate",
              label: dictation.recording ? "Stop" : "Dictate",
              icon: dictation.recording ? "micOff" : "voice",
              danger: dictation.recording,
              onSelect: dictation.toggle,
            },
            {
              id: "enhance",
              label: "Enhance",
              icon: "enhance",
              busy: enhancing,
              disabled: !prompt.trim() || enhancing,
              onSelect: () => void handleEnhance(),
            },
            {
              id: "shape",
              label: "Shape",
              icon: shape.w > shape.h ? "landscape" : shape.w < shape.h ? "portrait" : "squareShape",
              value: shape.label,
              onSelect: cycleShape,
            },
          ]}
          value={dictation.recording && dictation.interim ? `${prompt} ${dictation.interim}`.trim() : prompt}
          setValue={setPrompt}
          readOnly={dictation.recording}
          placeholder={
            dictation.recording
              ? "Listening…"
              : "A bioluminescent jellyfish drifting through a deep-sea trench…"
          }
          onSubmit={triggerGenerate}
          busy={generating}
          hint={`GMD ${generationCost} · ${aspectRatio}`}
          attachments={
            <DockAttachments
              items={images.map((img) => ({ id: img.id, kind: "image" as const, preview: img.preview }))}
              onRemove={(id) => setImages((prev) => prev.filter((i) => i.id !== id))}
            />
          }
          error={error}
          onDismissError={() => setError(null)}
        />
      )}
    >
      <StudioProjectsGrid
        pageSize={25}
        items={history.map((h) => ({
          id: h.id,
          status: h.status,
          prompt: h.prompt,
          mediaUrl: h.imageUrl || null,
          aspectRatio: h.aspectRatio,
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
        emptyTitle="No stills yet"
        emptyHint="Describe an image below and watch it land here."
      />

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
    </StudioShell>
  );
}

export default function ImageStudioPage() {
  return (
    <Suspense>
      <ImageWorkspace />
    </Suspense>
  );
}
