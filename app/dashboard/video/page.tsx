"use client";

// Video Studio — thin page shell. State, API handlers, and polling live here;
// the UI panels are split into ./_components. Clicking a project card opens
// the dedicated detail route /dashboard/video/[id].

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { useAuth } from "../../../components/AuthProvider";
import ConfirmGenerationModal from "../../../components/ConfirmGenerationModal";
import AssetPickerModal from "../../../components/AssetPickerModal";
import SettingsRail from "./_components/SettingsRail";
import ProjectsGrid from "./_components/ProjectsGrid";
import BottomPromptConsole from "./_components/BottomPromptConsole";
import {
  ASPECTS,
  DURATIONS,
  RESOLUTIONS,
  AttachedAudio,
  AttachedImage,
  AttachedVideo,
  HistoryItem,
} from "./_components/types";

function VideoWorkspace() {
  const { apiFetch, profile, refreshProfile } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Active inputs
  const [prompt, setPrompt] = useState(searchParams.get("prompt") ?? "");
  const model = "omni";

  const [confirmOpen, setConfirmOpen] = useState(false);

  const [aspect, setAspect] = useState<(typeof ASPECTS)[number]>("16:9");
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]>(10);
  const [resolution, setResolution] = useState<(typeof RESOLUTIONS)[number]>("720p");
  const [audioOn, setAudioOn] = useState(true);
  const [negativePrompt, setNegativePrompt] = useState("");
  const [images, setImages] = useState<AttachedImage[]>([]);
  const [videoFile, setVideoFile] = useState<AttachedVideo | null>(null);
  const [audioFile, setAudioFile] = useState<AttachedAudio | null>(null);

  // States
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [phase, setPhase] = useState<"idle" | "generating" | "done" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);
  const [enhancing, setEnhancing] = useState(false);
  const [openedMenuId, setOpenedMenuId] = useState<string | null>(null);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);

  const pollRefs = useRef<{ [key: string]: ReturnType<typeof setInterval> }>({});

  // Computed / Dynamic pricing properties — Flat-rate GMD 100.00 as specified
  const calculatedCost = 100;

  const triggerGenerate = () => {
    if (!prompt.trim() || phase === "generating") return;
    setConfirmOpen(true);
  };

  // Load list of all projects and videos
  const loadHistory = useCallback(() => {
    apiFetch<{ items: HistoryItem[] }>("/api/generations?type=video")
      .then((d) => {
        setHistory(d.items);
      })
      .catch(() => {});
  }, [apiFetch]);

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
            loadHistory();
            void refreshProfile();
            setHistory((prev) =>
              prev.map((item) =>
                item.id === id ? { ...item, status: "succeeded", videoUrl: status.videoUrl ?? null } : item
              )
            );
          } else if (status.status === "failed") {
            clearInterval(pollRefs.current[id]);
            delete pollRefs.current[id];
            loadHistory();
            void refreshProfile();
            setHistory((prev) =>
              prev.map((item) => (item.id === id ? { ...item, status: "failed" } : item))
            );
          }
        } catch {
          // Ignore status query glitches
        }
      }, 5000);
    },
    [apiFetch, loadHistory, refreshProfile]
  );

  useEffect(() => {
    loadHistory();
    const activePolls = pollRefs.current;
    return () => {
      // Clean up all active generation polls on unmount
      Object.values(activePolls).forEach((interval) => clearInterval(interval));
    };
  }, [loadHistory]);

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

  // Shared routing for image/video file-input attachments (video wins; image clears video)
  const handleAttachMediaFiles = (files: File[]) => {
    const video = files.find((f) => f.type.startsWith("video/"));
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    if (video) {
      attachVideo(video);
      setImages([]);
    } else if (imageFiles.length > 0) {
      imageFiles.forEach((img) => attachImage(img));
      setVideoFile(null);
    }
  };

  // Shared routing for drag-and-drop payloads (also accepts audio)
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
        body: JSON.stringify({ prompt }),
      });
      setPrompt(data.prompt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enhance failed");
    } finally {
      setEnhancing(false);
    }
  };

  // Submit Prompt (Google Flow Style: Creates dynamic card container on the screen instantly)
  const generate = async () => {
    if (!prompt.trim() || phase === "generating") return;

    setPhase("generating");
    setError(null);

    // Create a temporary local skeleton item to give instantaneous visual feedback
    const tempId = `temp_${Date.now()}`;
    const tempItem: HistoryItem = {
      id: tempId,
      status: "rendering",
      prompt: prompt,
      videoUrl: null,
      createdAt: new Date().toISOString(),
    };

    setHistory((prev) => [tempItem, ...prev]);
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
          negativePrompt: negativePrompt || undefined,
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
      void refreshProfile();
      setPhase("idle");

      // Replace temp skeleton with the actual API item
      setHistory((prev) =>
        prev.map((item) => (item.id === tempId ? { ...item, id: start.id, status: "rendering" } : item))
      );

      // Spin up polling thread for this item
      startSingleGenerationPolling(start.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setPhase("failed");
      // Remove temp skeleton
      setHistory((prev) => prev.filter((item) => item.id !== tempId));
      void refreshProfile();
    }
  };

  // Delete video project via API
  const deleteProject = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenedMenuId(null);
    try {
      if (pollRefs.current[id]) {
        clearInterval(pollRefs.current[id]);
        delete pollRefs.current[id];
      }
      await apiFetch(`/api/generations?id=${id}`, {
        method: "DELETE",
      });
      setHistory((prev) => prev.filter((item) => item.id !== id));
      void refreshProfile();
    } catch {
      // Optimistic delete
      if (pollRefs.current[id]) {
        clearInterval(pollRefs.current[id]);
        delete pollRefs.current[id];
      }
      setHistory((prev) => prev.filter((item) => item.id !== id));
    }
  };

  return (
    <div className="flex h-full bg-black text-white">
      {/* Settings & Financial Comparison Rail */}
      <SettingsRail
        aspect={aspect}
        setAspect={setAspect}
        duration={duration}
        setDuration={setDuration}
        resolution={resolution}
        setResolution={setResolution}
        audioOn={audioOn}
        setAudioOn={setAudioOn}
        negativePrompt={negativePrompt}
        setNegativePrompt={setNegativePrompt}
        credits={profile ? profile.credits : null}
      />

      {/* Main Viewport Stage */}
      <main className="flex-1 flex flex-col overflow-hidden bg-black relative">
        {/* Dynamic Canvas Area */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 pt-24">
          {/* Header navigation bar */}
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-neutral-900">
            <div>
              <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase tracking-widest block">
                CREATIVE FLOW
              </span>
              <h2 className="text-[18px] font-bold tracking-tight text-white mt-1">All Projects &amp; Stills</h2>
            </div>
          </div>

          <ProjectsGrid
            history={history}
            openedMenuId={openedMenuId}
            setOpenedMenuId={setOpenedMenuId}
            onOpen={(item) => {
              if (!item.id.startsWith("temp_")) router.push(`/dashboard/video/${item.id}`);
            }}
            onDelete={(id, e) => void deleteProject(id, e)}
          />
        </div>

        {/* Dynamic Error Status Alerts */}
        {error && (
          <div className="mx-8 mb-4 rounded-xl border border-red-950 bg-red-950/40 p-4 text-xs text-red-300 flex items-center justify-between animate-rise">
            <span>Error: {error}</span>
            <button onClick={() => setError(null)} className="text-neutral-500 hover:text-white">
              <X size={14} />
            </button>
          </div>
        )}

        {/* ── FLEXIBLE BOTTOM PROMPT CONSOLE ── */}
        <BottomPromptConsole
          prompt={prompt}
          setPrompt={setPrompt}
          enhance={() => void enhance()}
          enhancing={enhancing}
          phase={phase}
          onGenerate={triggerGenerate}
          images={images}
          removeImage={(id) => setImages((prev) => prev.filter((i) => i.id !== id))}
          videoFile={videoFile}
          clearVideoFile={() => setVideoFile(null)}
          audioFile={audioFile}
          clearAudioFile={() => setAudioFile(null)}
          onAttachMediaFiles={handleAttachMediaFiles}
          onAttachAudioFile={attachAudio}
          onDropFiles={handleDropFiles}
          onOpenAssetPicker={() => setAssetPickerOpen(true)}
        />
      </main>

      <ConfirmGenerationModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void generate()}
        cost={calculatedCost}
        balance={profile?.credits ?? 0}
        title="Confirm Video Generation"
        description={`You are about to generate a video clip. This will deduct GMD ${calculatedCost.toFixed(2)} from your wallet balance.`}
        actionLabel="Generate Video"
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

          if (character.voiceUrl) {
            setError(null);
            fetch(character.voiceUrl)
              .then((res) => res.blob())
              .then((blob) => {
                const reader = new FileReader();
                reader.onload = () => {
                  const dataUrl = reader.result as string;
                  setAudioFile({
                    base64: dataUrl.split(",")[1],
                    mimeType: blob.type || "audio/wav",
                    preview: dataUrl,
                    name: `${character.name}_voice.wav`,
                  });
                };
                reader.readAsDataURL(blob);
              })
              .catch(() => {
                setError("Failed to convert character voice for cloning reference");
              });
          }
        }}
        onSelectTrait={(trait) => {
          setPrompt((prev) => (prev ? `${prev}, ${trait}` : trait));
        }}
        onUploadFile={(file) => {
          if (file.type.startsWith("video/")) {
            attachVideo(file);
            setImages([]);
          } else if (file.type.startsWith("image/")) {
            attachImage(file);
            setVideoFile(null);
          } else if (file.type.startsWith("audio/")) {
            attachAudio(file);
          }
        }}
        allowedUploadTypes="image/*,video/*,audio/*"
      />
    </div>
  );
}

export default function VideoPage() {
  return (
    <Suspense>
      <VideoWorkspace />
    </Suspense>
  );
}
