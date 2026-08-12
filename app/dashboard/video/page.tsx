"use client";

// Video Studio — thin page shell. State, API handlers, and polling live here;
// the frame (island / rail / dock) comes from ../_shell. Clicking a project
// card opens the dedicated detail route /dashboard/video/[id].

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "../../../components/AuthProvider";
import ConfirmGenerationModal from "../../../components/ConfirmGenerationModal";
import StudioProjectsGrid from "../_shared/StudioProjectsGrid";
import { VIDEO_ASPECTS } from "../_shared/aspectOptions";
import StudioShell from "../_shell/StudioShell";
import StudioDock from "../_shell/StudioDock";
import DockAttachments, { DockAttachment } from "../_shell/DockAttachments";
import { RailGroup, RailChoice, RailShapes } from "../_shell/StudioRail";
import { STUDIO_NAV } from "../_shell/nav";
import { useDictation } from "../_shared/useDictation";
import { useGenerationHistory } from "../_shared/useGenerationHistory";
import { useReusePrompt } from "../_shared/useReusePrompt";
import { takePromptHandoff } from "../_shared/promptHandoff";
import {
  ASPECTS,
  DURATIONS,
  AttachedAudio,
  AttachedImage,
  AttachedVideo,
  HistoryItem,
} from "./_components/types";

function VideoWorkspace() {
  const { apiFetch, profile, pricing } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Active inputs
  const [prompt, setPrompt] = useState(searchParams.get("prompt") ?? "");
  const model = "omni";

  const [confirmOpen, setConfirmOpen] = useState(false);

  const [aspect, setAspect] = useState<(typeof ASPECTS)[number]>("16:9");
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]>(10);
  // Fixed render settings — no longer user-facing controls
  const resolution = "720p";
  const audioOn = true;
  const [images, setImages] = useState<AttachedImage[]>([]);
  const [videoFile, setVideoFile] = useState<AttachedVideo | null>(null);
  const [audioFile, setAudioFile] = useState<AttachedAudio | null>(null);

  // States
  const [phase, setPhase] = useState<"idle" | "generating" | "done" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);
  const [enhancing, setEnhancing] = useState(false);
  const [openedMenuId, setOpenedMenuId] = useState<string | null>(null);
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const pollRefs = useRef<{ [key: string]: ReturnType<typeof setInterval> }>({});
  const reusePrompt = useReusePrompt();
  // Dictation moved out of the input bar and onto its own dock tile — the mic
  // is a decision, not a 16px glyph wedged between a paperclip and a wand.
  const dictation = useDictation(setPrompt);

  // The wall. `useGenerationHistory` merges server truth over local state
  // instead of replacing it, so the optimistic card added below survives every
  // refresh until Firestore actually knows about it.
  const fetchVideos = useCallback(
    () => apiFetch<{ items: HistoryItem[] }>("/api/generations?type=video").then((d) => d.items || []),
    [apiFetch]
  );
  const { history, freshIds, load, addOptimistic, resolveOptimistic, removeItem, patchItem } =
    useGenerationHistory<HistoryItem>({ fetcher: fetchVideos });

  // Computed / Dynamic pricing — priced per generated second from live pricing
  const perSecondCost = pricing?.costs.videoPerSecond[model] ?? 15;
  const calculatedCost = perSecondCost * duration;

  const triggerGenerate = () => {
    if (!prompt.trim() || phase === "generating") return;
    setConfirmOpen(true);
  };

  // Triggers polling for a single specific background rendering item
  const startSingleGenerationPolling = useCallback(
    (id: string) => {
      if (pollRefs.current[id]) clearInterval(pollRefs.current[id]);

      pollRefs.current[id] = setInterval(async () => {
        try {
          const status = await apiFetch<{
            status: string;
            videoUrl?: string;
            error?: string;
          }>(`/api/video/status?id=${id}`);

          if (status.status === "succeeded") {
            clearInterval(pollRefs.current[id]);
            delete pollRefs.current[id];
            patchItem(id, { status: "succeeded", videoUrl: status.videoUrl ?? null });
            void load();
          } else if (status.status === "failed") {
            clearInterval(pollRefs.current[id]);
            delete pollRefs.current[id];
            patchItem(id, { status: "failed" });
            void load();
          }
        } catch {
          // Ignore status query glitches
        }
      }, 5000);
    },
    [apiFetch, load, patchItem]
  );

  useEffect(() => {
    const activePolls = pollRefs.current;
    return () => {
      // Clean up all active generation polls on unmount
      Object.values(activePolls).forEach((interval) => clearInterval(interval));
    };
  }, []);

  // Click-away listener for popover menu
  useEffect(() => {
    const handleGlobalClick = () => {
      setOpenedMenuId(null);
    };
    window.addEventListener("click", handleGlobalClick);
    return () => {
      window.removeEventListener("click", handleGlobalClick);
    };
  }, []);

  // Picks up a "reuse prompt" sent from the detail page — text plus the
  // reference images, which a query string can't carry. Reading sessionStorage
  // is exactly the "pull once from an external system on mount" case; it can't
  // move into a lazy initializer because sessionStorage doesn't exist during SSR
  // and the two renders would disagree.
  useEffect(() => {
    const handoff = takePromptHandoff();
    if (!handoff) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPrompt(handoff.prompt);
    setImages(handoff.images);
  }, []);

  // Resume background polling on page load for any item in rendering state
  useEffect(() => {
    history.forEach((item) => {
      const isGenerating =
        item.status === "rendering" || item.status === "generating" || item.status === "processing";
      if (isGenerating && !pollRefs.current[item.id] && !item.id.startsWith("temp_")) {
        startSingleGenerationPolling(item.id);
      }
    });
  }, [history, startSingleGenerationPolling]);

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

  const attachVideo = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      setVideoFile({ base64, mimeType: file.type, preview: dataUrl });
    };
    reader.readAsDataURL(file);
  };

  const attachAudio = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      setAudioFile({ base64, mimeType: file.type, preview: dataUrl, name: file.name });
    };
    reader.readAsDataURL(file);
  };

  // The ONE router for attachments, whether they arrive from the Attach tile's
  // picker or from a drop anywhere on the studio. Video wins over stills and
  // clears them; a still clears a video; audio is orthogonal and rides along.
  const handleDropFiles = (files: File[]) => {
    if (files.length === 0) return;
    const video = files.find((f) => f.type.startsWith("video/"));
    const audio = files.find((f) => f.type.startsWith("audio/"));
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));

    if (video) {
      attachVideo(video);
      setImages([]);
    } else if (imageFiles.length > 0) {
      imageFiles.forEach((img) => attachImage(img));
      setVideoFile(null);
    }

    if (audio) {
      attachAudio(audio);
    }
  };

  const enhance = async () => {
    if (!prompt.trim() || enhancing) return;
    setEnhancing(true);
    try {
      const data = await apiFetch<{ prompt: string }>("/api/enhance", {
        method: "POST",
        body: JSON.stringify({ prompt, kind: "video" }),
      });
      setPrompt(data.prompt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enhance failed");
    } finally {
      setEnhancing(false);
    }
  };

  // Pull a past generation's prompt AND its reference images back into the
  // console so it can be re-run or tweaked.
  const handleReuse = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenedMenuId(null);
    const reused = await reusePrompt(id);
    if (!reused) return;
    setPrompt(reused.prompt);
    setImages(reused.images);
    setVideoFile(null);
  };

  // Submit Prompt (Google Flow Style: Creates dynamic card container on the screen instantly)
  const generate = async () => {
    if (!prompt.trim() || phase === "generating") return;

    setPhase("generating");
    setError(null);

    // Create a temporary local skeleton item to give instantaneous visual feedback
    const tempId = `temp_${Date.now()}`;
    addOptimistic({
      id: tempId,
      status: "rendering",
      prompt: prompt,
      videoUrl: null,
      // Carried on the optimistic card so the placeholder is already the shape
      // of the shot being made, instead of snapping from 16:9 when it lands.
      aspectRatio: aspect,
      createdAt: new Date().toISOString(),
    } as HistoryItem);

    const originalPrompt = prompt;
    setPrompt(""); // Clear input bar immediately for next flow action

    try {
      const start = await apiFetch<{ id: string }>("/api/video/generate", {
        method: "POST",
        body: JSON.stringify({
          prompt: originalPrompt,
          model,
          aspectRatio: aspect,
          durationSeconds: duration,
          resolution,
          generateAudio: audioOn,
          imageBase64: images[0]?.base64 || undefined,
          imageMimeType: images[0]?.mimeType || undefined,
          images: images.map((img) => ({ base64: img.base64, mimeType: img.mimeType })),
          videoBase64: videoFile?.base64,
          videoMimeType: videoFile?.mimeType,
          audioBase64: audioFile?.base64,
          audioMimeType: audioFile?.mimeType,
        }),
      });

      setImages([]);
      setVideoFile(null);
      setAudioFile(null);
      setPhase("idle");

      // Replace temp skeleton with the actual API item
      resolveOptimistic(tempId, { id: start.id, status: "rendering" } as Partial<HistoryItem>);

      // Spin up polling thread for this item
      startSingleGenerationPolling(start.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setPhase("failed");
      // Remove temp skeleton
      removeItem(tempId);
    }
  };

  // Delete video project — fade the card out first, then drop it. The API call
  // fires in the background so the animation always feels instant.
  const deleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenedMenuId(null);
    if (pollRefs.current[id]) {
      clearInterval(pollRefs.current[id]);
      delete pollRefs.current[id];
    }
    setDeletingIds((prev) => new Set(prev).add(id));

    void apiFetch(`/api/generations?id=${id}`, { method: "DELETE" }).catch(() => {});

    // Let the fade-out play out, then remove the card from the list.
    setTimeout(() => {
      removeItem(id);
      setDeletingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 320);
  };

  // Everything staged for the next shot, in one list the dock can draw.
  const attachments: DockAttachment[] = [
    ...images.map((img) => ({ id: img.id, kind: "image" as const, preview: img.preview })),
    ...(videoFile ? [{ id: "__video__", kind: "video" as const, preview: videoFile.preview }] : []),
    ...(audioFile ? [{ id: "__audio__", kind: "audio" as const, name: audioFile.name }] : []),
  ];

  const removeAttachment = (id: string) => {
    if (id === "__video__") setVideoFile(null);
    else if (id === "__audio__") setAudioFile(null);
    else setImages((prev) => prev.filter((i) => i.id !== id));
  };

  return (
    <StudioShell
      navItems={STUDIO_NAV}
      activeId="video"
      title="All shots"
      railLabel="Shot setup"
      onDropFiles={handleDropFiles}
      dropHint="Drop stills, clips or a voice reference"
      rail={
        <>
          <RailGroup title="Shape" hint="Where it will be watched">
            <RailShapes
              options={VIDEO_ASPECTS}
              value={aspect}
              onChange={(v) => setAspect(v as (typeof ASPECTS)[number])}
            />
          </RailGroup>

          <RailGroup title="Length" hint="You pay per second">
            <div className="space-y-2">
              {DURATIONS.map((d) => (
                <RailChoice
                  key={d}
                  label={`${d} seconds`}
                  selected={d === duration}
                  onSelect={() => setDuration(d)}
                  icon="clock"
                  trailing={
                    <span
                      className={`text-[14px] font-bold tabular-nums ${
                        d === duration ? "text-background" : "text-ink-3"
                      }`}
                    >
                      {(perSecondCost * d).toFixed(0)}
                    </span>
                  }
                />
              ))}
            </div>
          </RailGroup>
        </>
      }
      dock={() => (
        <StudioDock
          tiles={[
            // One Attach tile, not two. Splitting "media" from "voice ref" gave
            // a whole quarter of the dock to a control most shots never touch,
            // and the picker can route by MIME type on its own — the same
            // routing the studio-wide drop target already does.
            {
              id: "attach",
              label: "Attach",
              icon: "addMedia",
              badge: images.length + (videoFile ? 1 : 0) + (audioFile ? 1 : 0),
              file: { accept: "image/*,video/*,audio/*", multiple: true, onFiles: handleDropFiles },
            },
            // The slot that bought back: length is the decision that changes
            // most often and costs the most, so it belongs where a thumb lands.
            {
              id: "length",
              label: "Length",
              icon: "clock",
              value: `${duration}s · ${(perSecondCost * duration).toFixed(0)}`,
              onSelect: () =>
                setDuration(DURATIONS[(DURATIONS.indexOf(duration) + 1) % DURATIONS.length]),
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
              onSelect: () => void enhance(),
            },
          ]}
          value={dictation.recording && dictation.interim ? `${prompt} ${dictation.interim}`.trim() : prompt}
          setValue={setPrompt}
          readOnly={dictation.recording}
          placeholder={
            dictation.recording
              ? "Listening…"
              : "A slow dolly through a rain-soaked neon market at night…"
          }
          onSubmit={triggerGenerate}
          busy={phase === "generating"}
          hint={`GMD ${calculatedCost.toFixed(0)} · ${duration}s · ${aspect}`}
          attachments={<DockAttachments items={attachments} onRemove={removeAttachment} />}
          error={error}
          onDismissError={() => setError(null)}
        />
      )}
    >
      <StudioProjectsGrid
        pageSize={12}
        items={history.map((h) => ({
          id: h.id,
          status: h.status,
          prompt: h.prompt,
          mediaUrl: h.videoUrl,
          aspectRatio: h.aspectRatio,
          createdAt: h.createdAt,
        }))}
        mediaType="video"
        openedMenuId={openedMenuId}
        setOpenedMenuId={setOpenedMenuId}
        deletingIds={deletingIds}
        freshIds={freshIds}
        onOpen={(item) => {
          if (!item.id.startsWith("temp_")) router.push(`/dashboard/video/${item.id}`);
        }}
        onDelete={(id, e) => deleteProject(id, e)}
        onReuse={(id, e) => void handleReuse(id, e)}
      />

      <ConfirmGenerationModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void generate()}
        cost={calculatedCost}
        balance={profile?.credits ?? 0}
        title="Confirm Video Generation"
        description={`${duration}s video clip`}
        actionLabel="Generate Video"
      />
    </StudioShell>
  );
}

export default function VideoPage() {
  return (
    <Suspense>
      <VideoWorkspace />
    </Suspense>
  );
}
