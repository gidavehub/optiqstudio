"use client";

import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Clapperboard,
  Download,
  ImagePlus,
  Loader2,
  Maximize,
  Pause,
  Play,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  MoreVertical,
  Trash2,
  ChevronLeft,
  Settings,
  Flame,
  DollarSign,
  UploadCloud,
  Mic,
  Plus,
} from "lucide-react";
import { useAuth } from "../../../components/AuthProvider";
import ConfirmGenerationModal from "../../../components/ConfirmGenerationModal";
import AssetPickerModal from "../../../components/AssetPickerModal";

interface HistoryItem {
  id: string;
  status: string;
  prompt: string;
  videoUrl: string | null;
  createdAt: string;
}

const ASPECTS = ["16:9", "9:16"] as const;
const DURATIONS = [4, 6, 8, 10] as const;
const RESOLUTIONS = ["720p", "1080p"] as const;

interface CustomVideoPlayerProps {
  src: string;
  aspect: "16:9" | "9:16";
}

function CustomVideoPlayer({ src, aspect }: CustomVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMute = !videoRef.current.muted;
    videoRef.current.muted = nextMute;
    setIsMuted(nextMute);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setDuration(videoRef.current.duration);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const val = parseFloat(e.target.value);
    videoRef.current.currentTime = val;
    setCurrentTime(val);
  };

  const handleFullscreen = () => {
    if (!videoRef.current) return;
    if (!document.fullscreenElement) {
      videoRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleEnded = () => {
    setIsPlaying(false);
  };

  useEffect(() => {
    Promise.resolve().then(() => setIsPlaying(true));
  }, [src]);

  return (
    <div className="group relative w-full overflow-hidden rounded-xl border border-neutral-800 bg-black shadow-2xl">
      <video
        ref={videoRef}
        src={src}
        autoPlay
        loop={false}
        onEnded={handleEnded}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onClick={togglePlay}
        className="w-full object-cover cursor-pointer"
        style={{ aspectRatio: aspect === "9:16" ? "9/16" : "16/9" }}
      />
      
      {/* Control overlay — stark monochrome glassmorphism */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col gap-2 z-20">
        
        {/* Progress seek bar */}
        <div className="flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1 bg-white/25 rounded-lg appearance-none cursor-pointer accent-white hover:h-1.5 transition-all"
            style={{
              background: `linear-gradient(to right, #ffffff ${((currentTime / (duration || 1)) * 100).toFixed(2)}%, rgba(255, 255, 255, 0.2) ${((currentTime / (duration || 1)) * 100).toFixed(2)}%)`
            }}
          />
        </div>

        {/* Action controls */}
        <div className="flex items-center justify-between mt-1">
          <div className="flex items-center gap-4">
            <button
              onClick={togglePlay}
              className="text-white hover:text-neutral-300 transition-colors p-1 rounded-full hover:bg-white/10"
            >
              {isPlaying ? <Pause size={16} fill="white" /> : <Play size={16} fill="white" />}
            </button>

            <span className="text-[11px] font-mono text-neutral-300">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleMute}
              className="text-white hover:text-neutral-300 transition-colors p-1 rounded-full hover:bg-white/10"
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>

            <button
              onClick={handleFullscreen}
              className="text-white hover:text-neutral-300 transition-colors p-1 rounded-full hover:bg-white/10"
            >
              <Maximize size={15} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AudioPlayerPreview({ audio }: { audio: { preview: string; name: string } }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const togglePlay = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-lg bg-neutral-900 border border-neutral-800 px-2.5 py-1.5 shrink-0 select-none">
      <audio ref={audioRef} src={audio.preview} onEnded={() => setIsPlaying(false)} className="hidden" />
      <button 
        type="button"
        onClick={togglePlay} 
        className="p-1 rounded-full bg-neutral-800 hover:bg-neutral-700 transition-colors text-violet-400 hover:text-violet-300 flex items-center justify-center shrink-0"
      >
        {isPlaying ? <Pause size={10} /> : <Play size={10} />}
      </button>
      <span className="text-[10px] text-neutral-300 font-mono max-w-[120px] truncate" title={audio.name}>
        {audio.name}
      </span>
    </div>
  );
}

function VideoWorkspace() {
  const { apiFetch, profile, pricing, refreshProfile } = useAuth();
  const searchParams = useSearchParams();

  // Drag and drop states for Refinement Console
  const [isDraggingRefine, setIsDraggingRefine] = useState(false);
  const dragCounterRefine = useRef(0);

  const handleDragEnterRefine = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRefine.current++;
    if (dragCounterRefine.current === 1) {
      setIsDraggingRefine(true);
    }
  };

  const handleDragLeaveRefine = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRefine.current--;
    if (dragCounterRefine.current === 0) {
      setIsDraggingRefine(false);
    }
  };

  const handleDragOverRefine = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropRefine = async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRefine.current = 0;
    setIsDraggingRefine(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      const video = files.find(f => f.type.startsWith("video/"));
      const audio = files.find(f => f.type.startsWith("audio/"));
      const imageFiles = files.filter(f => f.type.startsWith("image/"));

      if (video) {
        attachVideo(video);
        setImages([]);
      } else if (imageFiles.length > 0) {
        imageFiles.forEach(img => attachImage(img));
        setVideoFile(null);
      }

      if (audio) {
        attachAudio(audio);
      }
    }
  };

  // Drag and drop states for Bottom Console
  const [isDraggingBottom, setIsDraggingBottom] = useState(false);
  const dragCounterBottom = useRef(0);

  const handleDragEnterBottom = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterBottom.current++;
    if (dragCounterBottom.current === 1) {
      setIsDraggingBottom(true);
    }
  };

  const handleDragLeaveBottom = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterBottom.current--;
    if (dragCounterBottom.current === 0) {
      setIsDraggingBottom(false);
    }
  };

  const handleDragOverBottom = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropBottom = async (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterBottom.current = 0;
    setIsDraggingBottom(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length > 0) {
      const video = files.find(f => f.type.startsWith("video/"));
      const audio = files.find(f => f.type.startsWith("audio/"));
      const imageFiles = files.filter(f => f.type.startsWith("image/"));

      if (video) {
        attachVideo(video);
        setImages([]);
      } else if (imageFiles.length > 0) {
        imageFiles.forEach(img => attachImage(img));
        setVideoFile(null);
      }

      if (audio) {
        attachAudio(audio);
      }
    }
  };

  // Active inputs
  const [prompt, setPrompt] = useState(searchParams.get("prompt") ?? "");
  const model = "omni";

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"generate" | "edit" | null>(null);

  const [aspect, setAspect] = useState<(typeof ASPECTS)[number]>("16:9");
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]>(10);
  const [resolution, setResolution] = useState<(typeof RESOLUTIONS)[number]>("720p");
  const [audioOn, setAudioOn] = useState(true);
  const [negativePrompt, setNegativePrompt] = useState("");
  const [images, setImages] = useState<{ id: string; base64: string; mimeType: string; preview: string }[]>([]);
  const [videoFile, setVideoFile] = useState<{ base64: string; mimeType: string; preview: string } | null>(null);
  const [audioFile, setAudioFile] = useState<{ base64: string; mimeType: string; preview: string; name: string } | null>(null);

  // States
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeItem, setActiveItem] = useState<HistoryItem | null>(null);
  const [phase, setPhase] = useState<"idle" | "generating" | "done" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);
  const [enhancing, setEnhancing] = useState(false);
  const [openedMenuId, setOpenedMenuId] = useState<string | null>(null);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);

  const pollRefs = useRef<{ [key: string]: ReturnType<typeof setInterval> }>({});

  // Computed / Dynamic pricing properties
  const perSecCost = (pricing?.costs?.videoPerSecond?.[model as string]) ?? ((model as string) === "omni-fast" ? 15 : 30);
  const cappedDuration = Math.min(Math.max(Number(duration) || 8, 4), 10);
  const calculatedCost = perSecCost * cappedDuration;

  const perSecond = pricing?.costs.videoPerSecond?.[model] ?? (model === "omni" ? 12 : 5);
  const cost = perSecond * duration;

  const triggerGenerate = () => {
    if (!prompt.trim() || phase === "generating") return;
    setPendingAction("generate");
    setConfirmOpen(true);
  };

  const triggerEditPromptInOmni = () => {
    if (!activeItem || !prompt.trim() || phase === "generating") return;
    setPendingAction("edit");
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    if (pendingAction === "generate") {
      void generate();
    } else if (pendingAction === "edit") {
      void handleEditPromptInOmni();
    }
    setPendingAction(null);
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
  const startSingleGenerationPolling = useCallback((id: string) => {
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
          
          // Refresh lists & update active item view if applicable
          loadHistory();
          void refreshProfile();

          setHistory((prev) => 
            prev.map((item) => 
              item.id === id 
                ? { ...item, status: "succeeded", videoUrl: status.videoUrl ?? null } 
                : item
            )
          );

          setActiveItem((prev) => {
            if (prev && prev.id === id) {
              return { ...prev, status: "succeeded", videoUrl: status.videoUrl ?? null };
            }
            return prev;
          });
        } else if (status.status === "failed") {
          clearInterval(pollRefs.current[id]);
          delete pollRefs.current[id];
          
          loadHistory();
          void refreshProfile();

          setHistory((prev) => 
            prev.map((item) => 
              item.id === id 
                ? { ...item, status: "failed" } 
                : item
            )
          );

          setActiveItem((prev) => {
            if (prev && prev.id === id) {
              return { ...prev, status: "failed" };
            }
            return prev;
          });
        }
      } catch {
        // Ignore status query glitches
      }
    }, 5000);
  }, [apiFetch, loadHistory, refreshProfile, setHistory, setActiveItem]);

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
      if (item.status === "rendering" && !pollRefs.current[item.id] && !item.id.startsWith("temp_")) {
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
        { id: Math.random().toString(36).substring(2, 9), base64, mimeType: file.type, preview: dataUrl }
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
      createdAt: new Date().toISOString()
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
        prev.map((item) => 
          item.id === tempId ? { ...item, id: start.id, status: "rendering" } : item
        )
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
      await apiFetch(`/api/generations?id=${id}`, {
        method: "DELETE"
      });
      setHistory((prev) => prev.filter((item) => item.id !== id));
      if (activeItem?.id === id) {
        setActiveItem(null);
      }
      void refreshProfile();
    } catch {
      // Optimistic delete
      setHistory((prev) => prev.filter((item) => item.id !== id));
    }
  };

  // Click to open detail model panel
  const handleOpenDetailModal = (item: HistoryItem) => {
    setActiveItem(item);
  };

  // Edit / Refine existing generation in Omni
  const handleEditPromptInOmni = async () => {
    if (!activeItem || !prompt.trim() || phase === "generating") return;
    setPhase("generating");
    setError(null);
    
    const originalEditPrompt = prompt;
    setPrompt(""); // Clear prompt box

    // Create a temporary local skeleton item to give instantaneous visual feedback
    const tempId = `temp_${Date.now()}`;
    const tempItem: HistoryItem = {
      id: tempId,
      status: "rendering",
      prompt: `[EDIT] ${originalEditPrompt}`,
      videoUrl: null,
      createdAt: new Date().toISOString()
    };

    // Add to main viewport history and show it as active immediately
    setHistory((prev) => [tempItem, ...prev]);
    setActiveItem(tempItem);

    try {
      const start = await apiFetch<{ id: string }>("/api/video/generate", {
        method: "POST",
        body: JSON.stringify({
          prompt: `Modify video: ${originalEditPrompt}. Context base: ${activeItem.prompt}`,
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
        prev.map((item) => 
          item.id === tempId ? { ...item, id: start.id, status: "rendering" } : item
        )
      );
      
      // Update activeItem to have the real ID so we poll correctly
      setActiveItem((prev) => prev && prev.id === tempId ? { ...prev, id: start.id } : prev);

      // Spin up polling thread for this item
      startSingleGenerationPolling(start.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Edit failed");
      setPhase("failed");
      // Remove temp skeleton
      setHistory((prev) => prev.filter((item) => item.id !== tempId));
      setActiveItem(null); // Go back to library on failure
      void refreshProfile();
    }
  };

  return (
    <div className="flex h-full bg-black text-white">
      
      {/* Settings & Financial Comparison Rail */}
      <aside className="w-68 shrink-0 space-y-6 overflow-y-auto border-r border-neutral-900 p-5 bg-[#070707] flex flex-col justify-between">
        <div className="space-y-6">
          <div className="flex items-center gap-2 pb-2 border-b border-neutral-900">
            <Settings size={15} className="text-neutral-400 animate-pulse" />
            <span className="text-xs font-bold font-mono text-neutral-400 uppercase tracking-widest">
              WORKSPACE CONFIG
            </span>
          </div>

          <div>
            <p className="eyebrow mb-2">Engine Model</p>
            <div className="rounded-lg border border-neutral-800 bg-[#0d0d0e] px-3 py-2.5">
              <p className="text-sm font-medium text-white flex items-center gap-2">
                <Flame size={14} className="text-neutral-300" />
                Gemini Omni Flash
              </p>
              <p className="text-[11px] text-neutral-400 mt-0.5">Highest fidelity, native audio sync</p>
            </div>
          </div>

          <Segmented label="Aspect ratio" options={ASPECTS} value={aspect} onChange={setAspect} />
          <Segmented
            label="Duration"
            options={DURATIONS}
            value={duration}
            onChange={setDuration}
            render={(d) => `${d}s`}
          />
          <Segmented label="Resolution" options={RESOLUTIONS} value={resolution} onChange={setResolution} />

          <div>
            <p className="eyebrow mb-2">Native Audio Track</p>
            <button
              onClick={() => setAudioOn(!audioOn)}
              className="flex w-full items-center justify-between rounded-lg border border-neutral-800 bg-[#0d0d0e] px-3 py-2.5 text-sm hover:border-neutral-700 transition-colors"
            >
              <span>{audioOn ? "Synthesize on-the-fly" : "Silent render"}</span>
              {audioOn ? <Volume2 size={14} /> : <VolumeX size={14} className="text-neutral-500" />}
            </button>
          </div>

          <div>
            <p className="eyebrow mb-2">Negative restrictions</p>
            <textarea
              rows={1}
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="Blurry, low-fps, artifacts…"
              className="w-full resize-none rounded-lg border border-neutral-800 bg-[#0d0d0e] px-3 py-2 text-xs placeholder:text-neutral-600 focus:border-neutral-700 font-mono"
            />
          </div>
        </div>

        {/* ── CREDIT ESTIMATION & GENERATION UTILITY ── */}
        <div className="border-t border-neutral-900 pt-5 mt-auto">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign size={14} className="text-neutral-300" />
            <span className="text-[10px] font-bold font-mono text-neutral-400 uppercase tracking-wider">
              Credit Utility Guide
            </span>
          </div>
          <div className="bg-[#040405] rounded-xl p-3.5 border border-neutral-900 text-[11px] space-y-2.5">
            <p className="text-[10px] text-neutral-500 leading-normal font-sans">
              Credits power every workspace generation on Optiq Studio. Here is a breakdown of active generation costs:
            </p>
            <div className="space-y-1.5 font-mono text-[10px] text-neutral-400 border-t border-neutral-900 pt-2.5">
              <div className="flex justify-between">
                <span>Video Generation:</span>
                <span className="text-white font-semibold">30 cr / sec</span>
              </div>
              <div className="flex justify-between">
                <span>Standard Image:</span>
                <span className="text-white font-semibold">50 cr</span>
              </div>
              <div className="flex justify-between">
                <span>Character Sheet:</span>
                <span className="text-white font-semibold">150 cr</span>
              </div>
              <div className="flex justify-between">
                <span>Audio Synthesis:</span>
                <span className="text-white font-semibold">10 cr / 100 chars</span>
              </div>
            </div>
            <p className="text-[9px] text-neutral-500 leading-normal border-t border-neutral-900 pt-2 font-sans italic">
              * A standard 10-second scene generation consumes exactly 300 credits.
            </p>
          </div>
          
          <div className="rounded-lg border border-neutral-900 bg-[#0d0d0e]/50 px-3 py-2 mt-3 text-[10px] text-neutral-400 font-mono flex justify-between">
            <span>Run Cost: <strong className="text-white font-semibold">{cost} cr</strong></span>
            <span>Balance: <strong className="text-neutral-200">{profile ? profile.credits.toLocaleString() : "—"}</strong></span>
          </div>
        </div>
      </aside>

      {/* Main Viewport Stage */}
      <main className="flex-1 flex flex-col overflow-hidden bg-black relative">
        
        {/* Dynamic Canvas Area (Dynamic blurred nodes appear directly here) */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          
          {/* Header navigation bar */}
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-neutral-900">
            <div>
              <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase tracking-widest block">
                CREATIVE FLOW
              </span>
              <h2 className="text-[18px] font-bold tracking-tight text-white mt-1">
                {activeItem ? "Detailed View & Omni Editing" : "All Projects & Stills"}
              </h2>
            </div>
            
            {activeItem && (
              <button
                onClick={() => setActiveItem(null)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-neutral-800 bg-[#0d0d0e]/80 hover:bg-neutral-800 text-xs font-semibold text-neutral-300 hover:text-white transition-all shadow-md"
              >
                <ChevronLeft size={14} />
                Back to Projects
              </button>
            )}
          </div>

          {activeItem ? (
            /* Detailed editing viewport focusing on the open project card */
            <div className="w-full flex flex-col gap-6 animate-rise">
              
              {/* Left Side: Monitor Player / Loading Blur */}
              <div className="w-full">
                {activeItem.status === "rendering" || !activeItem.videoUrl ? (
                  <div className="relative aspect-video rounded-2xl border border-neutral-800 flex flex-col items-center justify-center p-8 text-center overflow-hidden bg-[#070708]">
                    {/* Glowing dynamic backdrop blur overlay */}
                    <div className="absolute -inset-[20px] opacity-40">
                      <div className="absolute top-1/4 left-1/4 w-40 h-40 rounded-full bg-indigo-500/20 blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
                      <div className="absolute bottom-1/4 right-1/4 w-44 h-44 rounded-full bg-neutral-600/20 blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
                      <div className="absolute top-1/2 right-1/3 w-36 h-36 rounded-full bg-neutral-500/10 blur-3xl animate-pulse" style={{ animationDuration: '3s' }} />
                    </div>
                    <div className="absolute inset-0 backdrop-blur-2xl bg-black/40" />
                    
                    <Loader2 size={32} className="animate-spin text-white mb-4 z-10" />
                    <span className="text-sm font-semibold tracking-tight text-white mb-1 z-10 uppercase font-mono">
                      Rendering Stream...
                    </span>
                    <p className="text-xs text-neutral-400 max-w-sm z-10 leading-normal font-sans">
                      Our Gemini Omni Flash engine is generating frames. This usually takes 1-3 minutes.
                    </p>
                  </div>
                ) : (
                  <CustomVideoPlayer src={activeItem.videoUrl} aspect={aspect} />
                )}
              </div>

              {/* Bottom Info & Action Panel */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Meta Panel */}
                <div className="md:col-span-1 p-5 bg-[#09090b]/85 rounded-2xl border border-neutral-900 backdrop-blur flex flex-col justify-between min-h-[220px]">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="inline-block text-[9px] font-bold font-mono text-neutral-400 bg-black border border-neutral-800 px-2.5 py-1 rounded uppercase tracking-wider">
                        Project Meta
                      </span>
                      <span className="text-[10px] font-mono text-neutral-500">
                        {new Date(activeItem.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Project ID</p>
                      <p className="text-xs font-mono text-neutral-300 break-all">{activeItem.id}</p>
                    </div>

                    <div className="space-y-1">
                      <p className="text-[10px] font-mono text-neutral-500 uppercase tracking-widest">Prompt Description</p>
                      <p className="text-xs text-neutral-300 font-sans leading-relaxed italic border-l border-neutral-800 pl-3">
                        &ldquo;{activeItem.prompt}&rdquo;
                      </p>
                    </div>
                  </div>

                  {activeItem.videoUrl && (
                    <div className="pt-4 border-t border-neutral-900 mt-6">
                      <a
                        href={activeItem.videoUrl}
                        download={`optiq_${activeItem.id}.mp4`}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-black hover:bg-neutral-200 transition-all active:scale-[0.98] shadow-md cursor-pointer"
                      >
                        <Download size={13} />
                        Download MP4
                      </a>
                    </div>
                  )}
                </div>

                {/* Edit & Refine Console (OMNI EDIT CONSOLE PLACED DIRECTLY HERE INSIDE THE MODAL/DETAIL VIEW) */}
                <div className="md:col-span-2 p-5 bg-[#09090b]/85 rounded-2xl border border-neutral-900 backdrop-blur flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-bold font-mono text-neutral-400 uppercase tracking-widest">
                      OMNI REFINEMENT CONSOLE
                    </h3>
                    <p className="text-xs text-neutral-500 mt-1.5 leading-normal font-sans">
                      Omni supports high-end editing pipelines. Input your adjustment instructions (e.g. &ldquo;make it rain heavily&rdquo;, &ldquo;render a dramatic red background&rdquo;, or &ldquo;change the shot to a close-up tracking camera&rdquo;) to edit this scene.
                    </p>
                  </div>

                  {/* Refinement Prompt Input Box */}
                  <div className="space-y-3 mt-4">
                    {images.length > 0 && (
                      <div className="flex flex-wrap items-center gap-3">
                        {images.map((img) => (
                          <div key={img.id} className="relative group flex items-center gap-1.5">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={img.preview} alt="Reference" className="h-12 w-14 rounded-lg object-cover border border-neutral-800" />
                            <button 
                              onClick={() => setImages((prev) => prev.filter((i) => i.id !== img.id))} 
                              className="absolute -top-1.5 -right-1.5 bg-neutral-900/90 text-neutral-400 hover:text-white rounded-full p-0.5 border border-neutral-800 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                        <span className="text-[10px] text-neutral-500 font-mono">{images.length} Reference image{images.length > 1 ? 's' : ''} attached</span>
                      </div>
                    )}

                    {videoFile && (
                      <div className="flex items-center gap-3">
                        <video src={videoFile.preview} className="h-12 w-14 rounded-lg object-cover border border-neutral-800" muted playsInline />
                        <button onClick={() => setVideoFile(null)} className="text-neutral-500 hover:text-white">
                          <X size={14} />
                        </button>
                        <span className="text-[10px] text-neutral-500 font-mono">Reference video attached</span>
                      </div>
                    )}

                    {audioFile && (
                      <div className="flex items-center gap-3">
                        <AudioPlayerPreview audio={audioFile} />
                        <button onClick={() => setAudioFile(null)} className="text-neutral-500 hover:text-white">
                          <X size={14} />
                        </button>
                        <span className="text-[10px] text-neutral-500 font-mono">Voice reference attached</span>
                      </div>
                    )}

                    <div 
                      className="relative flex items-center gap-3 rounded-xl border border-neutral-800 bg-[#0c0c0e] p-2.5 shadow-inner transition-all duration-300"
                      onDragEnter={handleDragEnterRefine}
                      onDragOver={handleDragOverRefine}
                      onDragLeave={handleDragLeaveRefine}
                      onDrop={handleDropRefine}
                    >
                      {/* Gorgeous Drop Overlay for Refinement Console */}
                      {isDraggingRefine && (
                        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-xl border border-dashed border-white/30 bg-black/85 backdrop-blur-sm pointer-events-none transition-all duration-300">
                          <UploadCloud size={20} className="text-white animate-pulse animate-bounce-subtle" />
                          <span className="text-[10px] font-mono tracking-widest text-white mt-1 uppercase">Drop Media</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setAssetPickerOpen(true)}
                          className="p-1.5 text-neutral-400 hover:text-white transition-colors"
                          title="Open Asset Composer"
                        >
                          <Plus size={16} />
                        </button>
                        <label className="cursor-pointer p-1.5 text-neutral-400 hover:text-white transition-colors" title="Attach reference media (image/video)">
                          <ImagePlus size={16} />
                          <input
                            type="file"
                            accept="image/*,video/*"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              const files = Array.from(e.target.files || []);
                              if (files.length === 0) return;
                              const video = files.find(f => f.type.startsWith("video/"));
                              const imageFiles = files.filter(f => f.type.startsWith("image/"));

                              if (video) {
                                attachVideo(video);
                                setImages([]);
                              } else if (imageFiles.length > 0) {
                                imageFiles.forEach(img => attachImage(img));
                                setVideoFile(null);
                              }
                            }}
                          />
                        </label>
                        <label className="cursor-pointer p-1.5 text-neutral-400 hover:text-white transition-colors" title="Attach voice reference (audio)">
                          <Mic size={16} />
                          <input
                            type="file"
                            accept="audio/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              attachAudio(file);
                            }}
                          />
                        </label>
                      </div>
                      
                      <textarea
                        rows={1}
                        value={prompt}
                        onChange={(e) => {
                          setPrompt(e.target.value);
                          e.target.style.height = 'auto';
                          e.target.style.height = `${e.target.scrollHeight}px`;
                        }}
                        placeholder="Instruct Omni to modify or edit this video..."
                        className="flex-1 resize-none bg-transparent py-1 text-xs placeholder:text-neutral-600 max-h-24 overflow-y-auto focus:outline-none"
                      />

                      <button
                        onClick={enhance}
                        disabled={enhancing || !prompt.trim()}
                        title="Enhance prompt"
                        className="p-1.5 text-neutral-400 hover:text-white transition-colors disabled:opacity-40"
                      >
                        {enhancing ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                      </button>

                      <button
                        onClick={triggerEditPromptInOmni}
                        disabled={phase === "generating" || !prompt.trim()}
                        className="rounded-lg bg-white px-4 py-1.5 text-xs font-semibold text-black hover:bg-neutral-200 transition-colors disabled:opacity-40 shrink-0"
                      >
                        {phase === "generating" ? "Editing..." : "Omni Edit"}
                      </button>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          ) : (
            /* Main projects catalog displaying a dynamic Google Flow list of project cards */
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {history.map((item) => {
                  const isRendering = item.status === "rendering" || !item.videoUrl;
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleOpenDetailModal(item)}
                      className="group bg-[#09090a]/60 border border-neutral-900 hover:border-neutral-800 hover:bg-[#0c0c0e] rounded-2xl overflow-hidden shadow-sm transition-all duration-300 flex flex-col justify-between aspect-video relative cursor-pointer"
                    >
                      {/* Dynamic Blur Thumbnail Container */}
                      <div className="relative flex-1 overflow-hidden flex items-center justify-center h-full w-full">
                        
                        {isRendering ? (
                          /* Generating dynamic shifting blur state with loading elements inside center */
                          <div className="absolute inset-0 bg-[#070708] overflow-hidden flex items-center justify-center p-4">
                            {/* Glowing shifting orbs */}
                            <div className="absolute -inset-[20px] opacity-40">
                              <div className="absolute top-1/4 left-1/4 w-32 h-32 rounded-full bg-indigo-500/20 blur-2xl animate-pulse" style={{ animationDuration: '4s' }} />
                              <div className="absolute bottom-1/4 right-1/4 w-36 h-36 rounded-full bg-neutral-600/20 blur-2xl animate-pulse" style={{ animationDuration: '6s' }} />
                              <div className="absolute top-1/2 right-1/3 w-28 h-28 rounded-full bg-neutral-500/10 blur-2xl animate-pulse" style={{ animationDuration: '3s' }} />
                            </div>
                            <div className="absolute inset-0 backdrop-blur-2xl bg-black/40 z-10" />
                            
                            <div className="relative z-20 flex flex-col items-center max-w-[85%] text-center">
                              <Loader2 size={22} className="animate-spin text-white/80 mb-3" />
                              <span className="text-[10px] font-mono tracking-widest text-neutral-400 uppercase mb-2">
                                Generating shot
                              </span>
                              <p className="text-xs text-neutral-200 line-clamp-3 leading-relaxed font-sans font-medium px-2 drop-shadow">
                                {item.prompt}
                              </p>
                            </div>
                          </div>
                        ) : (
                          /* Done state: Render unblurred completed preview video */
                          <div className="absolute inset-0 h-full w-full">
                            <video
                              src={item.videoUrl ?? undefined}
                              playsInline
                              muted
                              loop
                              autoPlay
                              className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                            />
                            {/* Ambient gradient overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent z-10" />

                            {/* Hover overlay — displays prompt in the center elegantly */}
                            <div className="absolute inset-0 bg-black/65 backdrop-blur-md transition-opacity duration-300 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center p-5 text-center z-20">
                              <div className="p-2 rounded-full bg-white/10 border border-white/20 mb-3 scale-90 group-hover:scale-100 transition-all duration-300">
                                <Play size={16} fill="white" className="text-white translate-x-[1px]" />
                              </div>
                              <p className="text-xs text-neutral-100 line-clamp-3 leading-relaxed font-sans font-medium max-w-[90%] px-1">
                                {item.prompt}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Top-Right Menu Button Actions */}
                        <div className="absolute top-3 right-3 z-30">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenedMenuId(openedMenuId === item.id ? null : item.id);
                            }}
                            className="p-1.5 rounded-full bg-black/60 backdrop-blur-sm border border-neutral-800 text-neutral-400 hover:text-white transition-colors hover:bg-neutral-900"
                          >
                            <MoreVertical size={13} />
                          </button>

                          {/* Popover Dropdown Actions Menu */}
                          {openedMenuId === item.id && (
                            <div className="absolute right-0 mt-1 w-28 bg-[#121314] border border-neutral-800 rounded-lg shadow-xl py-1 z-50">
                              <button
                                onClick={(e) => deleteProject(item.id, e)}
                                className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-neutral-900 hover:text-red-300 transition-colors flex items-center gap-1.5"
                              >
                                <Trash2 size={12} />
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  );
                })}

                {history.length === 0 && (
                  <div className="col-span-full py-28 text-center text-neutral-600 flex flex-col items-center">
                    <Clapperboard size={36} className="text-neutral-700 mb-4" />
                    <h3 className="text-sm font-semibold text-neutral-400">
                      No Projects Generated Yet
                    </h3>
                    <p className="text-xs text-neutral-600 max-w-xs leading-normal mt-1">
                      Type your script prompt below and see the dynamic, glassmorphic generation nodes appear.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

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

        {/* ── FLEXIBLE BOTTOM PROMPT CONSOLE (ONLY SHOWN WHEN NO ACTIVE ITEM IS OPENED) ── */}
        {!activeItem && (
          <div className="border-t border-neutral-900 p-5 bg-[#070707]/90 backdrop-blur-md relative z-40">
            
            {images.length > 0 && (
              <div className="mb-3 flex flex-wrap items-center gap-3">
                {images.map((img) => (
                  <div key={img.id} className="relative group flex items-center gap-1.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img.preview} alt="Reference" className="h-14 w-14 rounded-lg object-cover border border-neutral-800" />
                    <button 
                      onClick={() => setImages((prev) => prev.filter((i) => i.id !== img.id))} 
                      className="absolute -top-1.5 -right-1.5 bg-neutral-900/90 text-neutral-400 hover:text-white rounded-full p-0.5 border border-neutral-800 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={10} />
                    </button>
                  </div>
                ))}
                <span className="text-xs text-neutral-500">
                  {images.length} Reference image{images.length > 1 ? 's' : ''} attached
                </span>
              </div>
            )}

            {videoFile && (
              <div className="mb-3 flex items-center gap-3">
                <video src={videoFile.preview} className="h-14 w-14 rounded-lg object-cover border border-neutral-800" muted playsInline />
                <button onClick={() => setVideoFile(null)} className="text-neutral-500 hover:text-white">
                  <X size={14} />
                </button>
                <span className="text-xs text-neutral-500">Reference video attached</span>
              </div>
            )}

            {audioFile && (
              <div className="mb-3 flex items-center gap-3">
                <AudioPlayerPreview audio={audioFile} />
                <button onClick={() => setAudioFile(null)} className="text-neutral-500 hover:text-white">
                  <X size={14} />
                </button>
                <span className="text-xs text-neutral-500">Voice reference attached</span>
              </div>
            )}

            <div 
              className="relative flex items-center gap-3 rounded-2xl border border-neutral-800 bg-[#0a0a0c] p-3 w-full shadow-inner transition-all duration-300"
              onDragEnter={handleDragEnterBottom}
              onDragOver={handleDragOverBottom}
              onDragLeave={handleDragLeaveBottom}
              onDrop={handleDropBottom}
            >
              {/* Gorgeous Drop Overlay for Bottom Console */}
              {isDraggingBottom && (
                <div className="absolute inset-0 z-50 flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/30 bg-black/85 backdrop-blur-sm pointer-events-none transition-all duration-300">
                  <UploadCloud size={24} className="text-white animate-pulse animate-bounce-subtle" />
                  <span className="text-xs font-mono tracking-widest text-white mt-2 uppercase">Drop Image, Video or Audio</span>
                  <span className="text-[10px] text-neutral-500 mt-1">To use as a visual reference or voice profile</span>
                </div>
              )}

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setAssetPickerOpen(true)}
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
                      const video = files.find(f => f.type.startsWith("video/"));
                      const imageFiles = files.filter(f => f.type.startsWith("image/"));

                      if (video) {
                        attachVideo(video);
                        setImages([]);
                      } else if (imageFiles.length > 0) {
                        imageFiles.forEach(img => attachImage(img));
                        setVideoFile(null);
                      }
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
                      attachAudio(file);
                    }}
                  />
                </label>
              </div>
              <textarea
                rows={1}
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  e.target.style.height = 'auto';
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
                {enhancing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              </button>

              <button
                onClick={triggerGenerate}
                disabled={phase === "generating" || !prompt.trim()}
                className="rounded-full bg-white px-5 py-2 text-sm font-medium text-black hover:bg-neutral-200 transition-colors disabled:opacity-40 shrink-0"
              >
                {phase === "generating" ? "Generating…" : "Generate"}
              </button>
            </div>
          </div>
        )}

      </main>

      <ConfirmGenerationModal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirm}
        cost={calculatedCost}
        balance={profile?.credits ?? 0}
        title={pendingAction === "edit" ? "Confirm Video Modification" : "Confirm Video Generation"}
        description={
          pendingAction === "edit"
            ? `You are about to modify the selected video. This will deduct ${calculatedCost} credits from your balance.`
            : `You are about to generate a ${cappedDuration}s video. This will deduct ${calculatedCost} credits from your balance.`
        }
        actionLabel={pendingAction === "edit" ? "Omni Edit" : "Generate Video"}
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

function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  render,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  render?: (v: T) => string;
}) {
  return (
    <div>
      <p className="eyebrow mb-2">{label}</p>
      <div className="grid grid-flow-col gap-1 rounded-lg bg-[#0c0c0e] p-1 border border-neutral-900">
        {options.map((opt) => (
          <button
            key={String(opt)}
            onClick={() => onChange(opt)}
            className={`rounded-md px-2 py-1.5 text-xs transition-colors ${
              value === opt ? "bg-[#18181b] text-white" : "text-neutral-500 hover:text-white"
            }`}
          >
            {render ? render(opt) : String(opt)}
          </button>
        ))}
      </div>
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
