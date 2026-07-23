"use client";

// EditorFlowProvider — the single owner of storyboard-editor state.
//
// Previously all of this lived inside the monolithic dashboard/page.tsx as one
// giant component with a `view` state machine. Now the state lives here, at the
// dashboard layout level, so it survives navigation between the real routes
// (/dashboard, /dashboard/create, /dashboard/project/[id]). Each stage is its
// own page that reads this context via useEditorFlow().

import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../components/AuthProvider";
import { db, storage } from "../../../lib/firebase";
import {
  doc,
  updateDoc,
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  deleteDoc,
} from "firebase/firestore";
import { ref as storageRef, uploadString, getDownloadURL } from "firebase/storage";
import {
  BrandMaterial,
  DictationTarget,
  ProductionMode,
  ProjectLength,
  SceneImage,
  SceneImagesMap,
  Storyboard,
  VideoStatusMap,
  WizardStep,
} from "./types";

interface EditorFlowValue {
  // Auth passthrough (handy for views that only need these two)
  user: ReturnType<typeof useAuth>["user"];
  profile: ReturnType<typeof useAuth>["profile"];

  // Paywall / production-mode
  storyboardPayOpen: boolean;
  setStoryboardPayOpen: (v: boolean) => void;
  paywallStep: "pay" | "choose";
  setPaywallStep: (v: "pay" | "choose") => void;
  productionMode: ProductionMode;
  setProductionMode: (v: ProductionMode) => void;

  // Theater playback
  theaterPlaying: boolean;
  setTheaterPlaying: (v: boolean) => void;
  currentScenePlayIdx: number;
  setCurrentScenePlayIdx: React.Dispatch<React.SetStateAction<number>>;

  // Spot checkout card fields

  // Projects
  projects: any[];
  projectsLoading: boolean;
  activeProjectId: string | null;

  // Compilation / timeline
  compileStatus: "idle" | "compiling" | "succeeded" | "failed";
  compileVideoUrl: string;
  compileError: string;
  timeline: any[];
  setTimeline: React.Dispatch<React.SetStateAction<any[]>>;
  musicUrl: string; setMusicUrl: (v: string) => void;
  musicVolume: number; setMusicVolume: (v: number) => void;

  // Wizard
  wizardStep: WizardStep;
  setWizardStep: (v: WizardStep) => void;
  length: ProjectLength; setLength: (v: ProjectLength) => void;
  promptText: string; setPromptText: (v: string) => void;
  brandName: string; setBrandName: (v: string) => void;
  product: string; setProduct: (v: string) => void;
  brandMaterials: BrandMaterial[];
  isDragging: boolean; setIsDragging: (v: boolean) => void;

  // Prompt bar styling
  promptExpanded: boolean; setPromptExpanded: (v: boolean) => void;
  aspectRatio: string; setAspectRatio: (v: string) => void;
  aspectDropdownOpen: boolean; setAspectDropdownOpen: (v: boolean) => void;

  // Interaction
  recording: boolean;
  recordingTarget: DictationTarget | null;
  generating: boolean;
  error: string | null; setError: (v: string | null) => void;
  copiedIndex: number | null;

  // Storyboard + scene statuses
  storyboard: Storyboard | null;
  setStoryboard: React.Dispatch<React.SetStateAction<Storyboard | null>>;
  videoStatus: VideoStatusMap;
  setVideoStatus: React.Dispatch<React.SetStateAction<VideoStatusMap>>;

  // Cloud storyboard-generation progress (server-driven, survives tab close)
  pipelineStage: string | null;
  pipelineProgress: { scenesDone: number; scenesTotal: number } | null;
  retryStoryboard: () => Promise<void>;

  // Per-scene reference images (product/character consistency)
  sceneImages: SceneImagesMap;
  projectMaterials: SceneImage[];
  addSceneImages: (sceneIndex: number, files: FileList | File[]) => Promise<void>;
  attachMaterialToScene: (sceneIndex: number, material: SceneImage) => void;
  removeSceneImage: (sceneIndex: number, imageIndex: number) => void;

  // Handlers
  startSpeechRecognition: (target?: DictationTarget) => void;
  stopSpeechRecognition: () => void;
  handleMaterialsUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  removeBrandMaterial: (index: number) => void;
  generateStoryboard: () => Promise<void>;
  generateVideoForScene: (sceneIndex: number, promptText: string) => Promise<void>;
  reviseScenePrompt: (sceneIndex: number) => Promise<void>;
  copyToClipboard: (text: string, index: number) => void;
  handleCompileProject: () => Promise<void>;
  deleteProject: (e: React.MouseEvent, projectId: string) => Promise<void>;

  // Navigation
  goHome: () => void;
  goCreate: () => void;
  openProject: (proj: any) => void;
  openProjectRoute: (id: string) => void;
}

// Stages the server-side storyboard job (functions/storyboardGenerate) streams
// into the project doc while it works. "ready" / "failed" are terminal.
const PIPELINE_WORKING_STAGES = ["queued", "analyzing", "storylining", "casting", "building"];

const EditorFlowContext = createContext<EditorFlowValue | null>(null);

export function useEditorFlow(): EditorFlowValue {
  const ctx = useContext(EditorFlowContext);
  if (!ctx) throw new Error("useEditorFlow must be used within EditorFlowProvider");
  return ctx;
}

export function EditorFlowProvider({ children }: { children: React.ReactNode }) {
  const { user, profile, apiFetch, refreshProfile } = useAuth();
  const router = useRouter();

  // Paywall
  const [storyboardPayOpen, setStoryboardPayOpen] = useState(false);
  const [paywallStep, setPaywallStep] = useState<"pay" | "choose">("pay");
  const [productionMode, setProductionMode] = useState<ProductionMode>(null);
  const [theaterPlaying, setTheaterPlaying] = useState(false);
  const [currentScenePlayIdx, setCurrentScenePlayIdx] = useState(0);

  // Projects
  const [projects, setProjects] = useState<any[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [routeProjectId, setRouteProjectId] = useState<string | null>(null);

  // Compilation / timeline
  const [compileStatus, setCompileStatus] = useState<"idle" | "compiling" | "succeeded" | "failed">("idle");
  const [compileVideoUrl, setCompileVideoUrl] = useState<string>("");
  const [compileError, setCompileError] = useState<string>("");
  const [timeline, setTimeline] = useState<any[]>([]);
  const [musicUrl, setMusicUrl] = useState<string>("");
  const [musicVolume, setMusicVolume] = useState<number>(0.6);

  // Wizard
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [length, setLength] = useState<ProjectLength>("30s");
  const [promptText, setPromptText] = useState("");
  const [brandName, setBrandName] = useState("");
  const [product, setProduct] = useState("");
  const [brandMaterials, setBrandMaterials] = useState<BrandMaterial[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const [promptExpanded, setPromptExpanded] = useState(false);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [aspectDropdownOpen, setAspectDropdownOpen] = useState(false);

  const [recording, setRecording] = useState(false);
  const [recordingTarget, setRecordingTarget] = useState<DictationTarget | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [videoStatus, setVideoStatus] = useState<VideoStatusMap>({});

  // Cloud-generation progress for the active project. The storyboard is now
  // built by a server-side Firestore-triggered job (functions/storyboardGenerate)
  // that streams its stage into the project doc, so this survives a closed tab
  // and resumes on reopen. `null` = not a cloud-generating project.
  const [pipelineStage, setPipelineStage] = useState<string | null>(null);
  const [pipelineProgress, setPipelineProgress] = useState<{ scenesDone: number; scenesTotal: number } | null>(null);

  // Per-scene reference images. Mirrored in a ref so generation callbacks fired
  // right after a state update (or from stale closures) always see the latest.
  const [sceneImages, setSceneImages] = useState<SceneImagesMap>({});
  const [projectMaterials, setProjectMaterials] = useState<SceneImage[]>([]);
  const sceneImagesRef = useRef<SceneImagesMap>({});
  useEffect(() => {
    sceneImagesRef.current = sceneImages;
  }, [sceneImages]);

  // ─── PROJECT STATE LOADER (no navigation) ─────────────────────────────────
  const loadProjectState = useCallback((proj: any) => {
    // A project whose cloud job hasn't produced scenes yet: leave the storyboard
    // null so the workspace shows the live "generating" state (driven by
    // pipelineStage), not an empty scene grid.
    const stillGenerating =
      PIPELINE_WORKING_STAGES.includes(proj.pipelineStage) &&
      (!proj.scenes || proj.scenes.length === 0);

    setPipelineStage(proj.pipelineStage || null);
    setPipelineProgress(proj.pipelineProgress || null);

    if (stillGenerating) {
      setStoryboard(null);
    } else {
      setStoryboard({
        title: proj.title,
        concept: proj.concept,
        styleHeader: proj.styleHeader || "",
        characterLock: proj.characterLock || { name: "", description: "", wardrobe: "" },
        scenes: proj.scenes || [],
        isStory: proj.isStory,
        storyArc: proj.storyArc,
        musicSpec: proj.musicSpec,
        ambienceSpec: proj.ambienceSpec,
      });
    }
    if (proj.pipelineStage === "failed") setError(proj.pipelineError || "Storyboard generation failed");

    setSceneImages(proj.sceneImages || {});
    setProjectMaterials(proj.materials || []);
    setLength(proj.length);
    setBrandName(proj.brandName || "");
    setProduct(proj.product || "");
    setPromptText(proj.concept || "");
    setAspectRatio(proj.aspectRatio || "16:9");
    setVideoStatus(proj.videoStatus || {});
    setActiveProjectId(proj.id);
    setProductionMode(proj.productionMode || "manual");
    setCompileStatus(proj.compileStatus || "idle");
    setCompileVideoUrl(proj.compileVideoUrl || "");
    setCompileError(proj.compileError || "");
    setTimeline(proj.timeline || []);
    setMusicUrl(proj.musicUrl || "");
    setMusicVolume(proj.musicVolume ?? 0.6);
  }, []);

  // ─── NAVIGATION ───────────────────────────────────────────────────────────
  const goHome = useCallback(() => router.push("/dashboard"), [router]);
  const goCreate = useCallback(() => {
    setWizardStep(1);
    router.push("/dashboard/create");
  }, [router]);
  const openProject = useCallback(
    (proj: any) => {
      loadProjectState(proj);
      router.push(`/dashboard/project/${proj.id}`);
    },
    [loadProjectState, router]
  );
  const openProjectRoute = useCallback((id: string) => setRouteProjectId(id), []);

  // Clean up any polling intervals on unmount
  useEffect(() => {
    return () => {
      for (let i = 0; i < 20; i++) {
        const intervalId = (window as any)[`_scene_poll_${i}`];
        if (intervalId) clearInterval(intervalId);
      }
    };
  }, []);

  // ─── FIRESTORE PAST PROJECTS REAL-TIME LISTENER ──────────────────────────
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "projects"), where("uid", "==", user.uid));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        list.sort(
          (a: any, b: any) =>
            new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        );
        setProjects(list);
        setProjectsLoading(false);
      },
      (err) => {
        console.error("Failed to fetch past projects:", err);
        setProjectsLoading(false);
      }
    );
    return () => unsubscribe();
  }, [user]);

  // ─── AUTO-SYNC STATE TO FIRESTORE ON STATE MUTATIONS ──────────────────────
  useEffect(() => {
    if (!user || !activeProjectId || !storyboard) return;

    const cleanUndefined = (obj: any): any => {
      if (obj === null || typeof obj !== "object") return obj;
      if (Array.isArray(obj)) return obj.map(cleanUndefined);
      const clean: any = {};
      for (const key of Object.keys(obj)) {
        const val = obj[key];
        if (val !== undefined) clean[key] = cleanUndefined(val);
      }
      return clean;
    };

    const updateFirebaseProject = async () => {
      try {
        const projRef = doc(db, "projects", activeProjectId);
        await updateDoc(
          projRef,
          cleanUndefined({
            videoStatus,
            scenes: storyboard.scenes,
            title: storyboard.title,
            concept: storyboard.concept,
            styleHeader: storyboard.styleHeader,
            characterLock: storyboard.characterLock,
            musicSpec: storyboard.musicSpec ?? null,
            ambienceSpec: storyboard.ambienceSpec ?? null,
            aspectRatio,
            sceneImages,
            materials: projectMaterials,
            productionMode: productionMode || "manual",
            // compileStatus / compileVideoUrl / compileError are deliberately
            // NOT written here. They are owned by the server (projectCompile),
            // exactly like pipelineStage. Echoing local state back raced the
            // server: a debounced write still holding "compiling" could land
            // after the server wrote "succeeded", clobbering it — after which
            // doc and local agreed on "compiling" and the export UI spun
            // forever. We only ever read these.
            timeline,
            musicUrl,
            musicVolume,
            updatedAt: new Date().toISOString(),
          })
        );
      } catch (err) {
        console.error("Failed to auto-save project state to Firestore:", err);
      }
    };

    const timeout = setTimeout(() => void updateFirebaseProject(), 1500);
    return () => clearTimeout(timeout);
  }, [
    videoStatus,
    activeProjectId,
    storyboard,
    productionMode,
    user,
    timeline,
    musicUrl,
    musicVolume,
    aspectRatio,
    sceneImages,
    projectMaterials,
  ]);

  // ─── RESUME/ACTIVATE PROJECT FROM /project/[id] ROUTE ─────────────────────
  useEffect(() => {
    if (routeProjectId && projects.length > 0) {
      const match = projects.find((p) => p.id === routeProjectId);
      if (match) {
        if (activeProjectId !== match.id) {
          loadProjectState(match);
        } else {
          if (match.compileStatus !== compileStatus) setCompileStatus(match.compileStatus || "idle");
          if (match.compileVideoUrl !== compileVideoUrl) setCompileVideoUrl(match.compileVideoUrl || "");
          if (match.compileError !== compileError) setCompileError(match.compileError || "");
        }
      }
    }
  }, [routeProjectId, projects, activeProjectId, compileStatus, compileVideoUrl, compileError, loadProjectState]);

  // ─── HYDRATE FROM THE CLOUD STORYBOARD JOB ────────────────────────────────
  // Reflects the server-side generation stage into the UI in real time (via the
  // projects onSnapshot listener). When the job reaches "ready" we load the
  // freshly-written scenes; when it "failed" we surface the error. This is what
  // makes a reopened tab resume at the exact stage the cloud is at.
  useEffect(() => {
    if (!activeProjectId) return;
    const match = projects.find((p) => p.id === activeProjectId);
    if (!match) return;

    setPipelineStage(match.pipelineStage || null);
    setPipelineProgress(match.pipelineProgress || null);

    if (match.pipelineStage === "ready") {
      const loadedCount = storyboard?.scenes.length ?? 0;
      const docCount = match.scenes?.length ?? 0;
      if (!storyboard || (docCount > 0 && loadedCount !== docCount)) {
        loadProjectState(match);
      }
      setGenerating(false);
    } else if (match.pipelineStage === "failed") {
      setError(match.pipelineError || "Storyboard generation failed");
      setGenerating(false);
    } else if (PIPELINE_WORKING_STAGES.includes(match.pipelineStage)) {
      setGenerating(true);
    }
  }, [projects, activeProjectId, storyboard, loadProjectState]);

  // ─── INITIALIZE TIMELINE FROM COMPLETED VIDEOS ──────────────────────────
  useEffect(() => {
    if (!storyboard || !videoStatus) return;
    const completedCount = storyboard.scenes.filter(
      (_, idx) => videoStatus[idx]?.status === "succeeded"
    ).length;
    if (completedCount === storyboard.scenes.length && timeline.length === 0) {
      const defaultTimeline = storyboard.scenes.map((_, idx) => ({
        sceneIndex: idx,
        videoUrl: videoStatus[idx]?.url || "",
        trimStart: 0,
        trimEnd: 10,
        volume: 1.0,
      }));
      setTimeline(defaultTimeline);
    }
  }, [storyboard, videoStatus, timeline.length]);

  const handleCompileProject = useCallback(async () => {
    if (!activeProjectId || timeline.length === 0) return;
    setCompileStatus("compiling");
    setCompileError("");
    try {
      const payload = {
        projectId: activeProjectId,
        timeline: timeline.map((item, idx) => ({
          sceneIndex: item.sceneIndex,
          videoUrl: videoStatus[item.sceneIndex]?.url || item.videoUrl,
          trimStart: Number(item.trimStart) ?? 0,
          trimEnd: Number(item.trimEnd) ?? 10,
          volume: Number(item.volume) ?? 1.0,
          playOrder: idx,
        })),
        musicUrl: musicUrl || null,
        musicVolume: Number(musicVolume) ?? 0.2,
      };
      await apiFetch<{ status: string }>("/api/project/compile", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      console.log("Compilation triggered successfully");
    } catch (err: any) {
      console.error("Failed to trigger project compilation:", err);
      setCompileStatus("failed");
      setCompileError(err.message || "Request failed");
    }
  }, [activeProjectId, timeline, videoStatus, musicUrl, musicVolume, apiFetch]);

  const deleteProject = useCallback(async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to permanently delete this storyboard project?")) return;
    try {
      await deleteDoc(doc(db, "projects", projectId));
    } catch (err) {
      console.error("Failed to delete project document from Firestore:", err);
    }
  }, []);

  // Voice dictation — the same speech-to-text pipeline works on every wizard
  // text field (vision prompt, brand name, product/service).
  const startSpeechRecognition = useCallback(
    (target: DictationTarget = "prompt") => {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert("Speech recognition is not supported in this browser. Please type instead.");
        return;
      }
      const fieldByTarget: Record<DictationTarget, { value: string; set: (v: string) => void }> = {
        prompt: { value: promptText, set: setPromptText },
        brand: { value: brandName, set: setBrandName },
        product: { value: product, set: setProduct },
      };
      const field = fieldByTarget[target];
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = false;
      rec.lang = "en-US";
      const initialText = field.value;
      rec.onstart = () => {
        setRecording(true);
        setRecordingTarget(target);
      };
      rec.onresult = (e: any) => {
        let sessionText = "";
        for (let i = 0; i < e.results.length; i++) {
          if (e.results[i].isFinal) sessionText += e.results[i][0].transcript + " ";
        }
        const trimmed = sessionText.trim();
        if (trimmed) field.set(initialText ? `${initialText} ${trimmed}` : trimmed);
      };
      rec.onerror = (e: any) => {
        console.error("Speech recognition error:", e);
        setRecording(false);
        setRecordingTarget(null);
      };
      rec.onend = () => {
        setRecording(false);
        setRecordingTarget(null);
      };
      (window as any)._rec = rec;
      rec.start();
    },
    [promptText, brandName, product]
  );

  const stopSpeechRecognition = useCallback(() => {
    if ((window as any)._rec) (window as any)._rec.stop();
    setRecording(false);
    setRecordingTarget(null);
  }, []);

  const processUploadedFiles = useCallback((files: FileList) => {
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBrandMaterials((prev) => [...prev, { name: file.name, data: reader.result as string }]);
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const handleMaterialsUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) processUploadedFiles(files);
    },
    [processUploadedFiles]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      const files = e.dataTransfer.files;
      if (files && files.length > 0) processUploadedFiles(files);
    },
    [processUploadedFiles]
  );

  const removeBrandMaterial = useCallback((index: number) => {
    setBrandMaterials((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Inline scene video generation using Gemini Omni Flash
  const generateVideoForScene = useCallback(
    async (sceneIndex: number, promptTextArg: string) => {
      const existingInterval = (window as any)[`_scene_poll_${sceneIndex}`];
      if (existingInterval) clearInterval(existingInterval);

      setVideoStatus((prev) => {
        const copy = { ...prev };
        if (copy[sceneIndex]) {
          const updated = { ...copy[sceneIndex], status: "rendering" as const };
          delete updated.error;
          copy[sceneIndex] = updated;
        } else {
          copy[sceneIndex] = { status: "rendering" as const };
        }
        return copy;
      });

      try {
        // Attach this scene's reference images (brand/product/character
        // consistency) — the render backend reads them straight from Storage.
        const refs = sceneImagesRef.current[sceneIndex] || [];
        const res = await apiFetch<{ id: string }>("/api/video/generate", {
          method: "POST",
          body: JSON.stringify({
            prompt: promptTextArg,
            model: "omni",
            aspectRatio,
            durationSeconds: 10,
            // Ads carry NO baked-in sound: no dialogue, no voiceover, no ambience
            // in the footage. The ad's audio (Optiq Music score + optional TTS
            // narration) is composed at compile time. So scene clips are silent.
            generateAudio: false,
            // Lets the server draw this scene from the ad's prepaid allowance
            // instead of charging again.
            projectId: activeProjectId,
            imagePaths: refs.map((img) => ({ path: img.path, mimeType: img.mimeType })),
          }),
        });

        setVideoStatus((prev) => {
          const copy = { ...prev };
          if (copy[sceneIndex]) {
            const updated = { ...copy[sceneIndex], status: "rendering" as const, id: res.id };
            delete updated.error;
            copy[sceneIndex] = updated;
          }
          return copy;
        });

        const intervalId = setInterval(async () => {
          try {
            const status = await apiFetch<{ status: string; videoUrl?: string; error?: string }>(
              `/api/video/status?id=${res.id}`
            );
            if (status.status === "succeeded") {
              clearInterval(intervalId);
              setVideoStatus((prev) => ({
                ...prev,
                [sceneIndex]: { ...prev[sceneIndex], status: "succeeded", url: status.videoUrl },
              }));
              void refreshProfile();
            } else if (status.status === "failed") {
              clearInterval(intervalId);
              setVideoStatus((prev) => ({
                ...prev,
                [sceneIndex]: {
                  ...prev[sceneIndex],
                  status: "failed",
                  error: status.error || "Generation failed",
                },
              }));
              void refreshProfile();
            }
          } catch {
            /* ignore status network glitches */
          }
        }, 5000);

        (window as any)[`_scene_poll_${sceneIndex}`] = intervalId;
      } catch (err) {
        setVideoStatus((prev) => ({
          ...prev,
          [sceneIndex]: {
            ...prev[sceneIndex],
            status: "failed",
            error: err instanceof Error ? err.message : "Request failed",
          },
        }));
      }
    },
    [apiFetch, refreshProfile, aspectRatio, activeProjectId]
  );

  // Resume background polling with existing generation ID
  const resumePollingForScene = useCallback(
    async (sceneIndex: number, generationId: string) => {
      const existingInterval = (window as any)[`_scene_poll_${sceneIndex}`];
      if (existingInterval) clearInterval(existingInterval);

      setVideoStatus((prev) => {
        const copy = { ...prev };
        if (copy[sceneIndex]) {
          const updated = { ...copy[sceneIndex], status: "rendering" as const, id: generationId };
          delete updated.error;
          copy[sceneIndex] = updated;
        } else {
          copy[sceneIndex] = { status: "rendering" as const, id: generationId };
        }
        return copy;
      });

      const intervalId = setInterval(async () => {
        try {
          const status = await apiFetch<{ status: string; videoUrl?: string; error?: string }>(
            `/api/video/status?id=${generationId}`
          );
          if (status.status === "succeeded") {
            clearInterval(intervalId);
            setVideoStatus((prev) => ({
              ...prev,
              [sceneIndex]: { ...prev[sceneIndex], status: "succeeded", url: status.videoUrl },
            }));
            void refreshProfile();
          } else if (status.status === "failed") {
            clearInterval(intervalId);
            setVideoStatus((prev) => ({
              ...prev,
              [sceneIndex]: {
                ...prev[sceneIndex],
                status: "failed",
                error: status.error || "Generation failed",
              },
            }));
            void refreshProfile();
          }
        } catch {
          /* ignore status network glitches */
        }
      }, 5000);

      (window as any)[`_scene_poll_${sceneIndex}`] = intervalId;
    },
    [apiFetch, refreshProfile]
  );

  // Uploads the wizard's brand materials to per-user Storage so the cloud job
  // (and later the media library) can read them by path.
  const uploadBrandMaterials = useCallback(
    async (projectId: string): Promise<SceneImage[]> => {
      if (!user || brandMaterials.length === 0) return [];
      try {
        return await Promise.all(
          brandMaterials.map(async (mat, i) => {
            const safeName = mat.name.replace(/[^\w.-]/g, "_");
            const path = `users/${user.uid}/projects/${projectId}/materials/${i}-${safeName}`;
            const fileRef = storageRef(storage, path);
            await uploadString(fileRef, mat.data, "data_url");
            const url = await getDownloadURL(fileRef);
            const mimeType = /^data:([^;]+);/.exec(mat.data)?.[1] || "image/png";
            return { name: mat.name, path, url, mimeType };
          })
        );
      } catch (uploadErr) {
        console.error("Failed to persist brand materials to Storage:", uploadErr);
        return [];
      }
    },
    [user, brandMaterials]
  );

  // Trigger Storyboard Generation — fully cloud-managed. The client only
  // creates the project doc, uploads materials, and drops a job in
  // `storyboardJobs`. The server-side trigger (functions/storyboardGenerate)
  // runs the whole Optiq Skills swarm and writes the scenes + live stage back
  // to the project doc, so generation survives a closed tab and resumes on
  // reopen. No HTTP wait, no client-side result write.
  const generateStoryboard = useCallback(async () => {
    if (!promptText.trim()) {
      alert("Please describe your campaign or video pitch.");
      return;
    }
    if (!user) {
      alert("Please sign in to generate a storyboard.");
      return;
    }

    setGenerating(true);
    setError(null);
    setStoryboard(null);
    setSceneImages({});
    sceneImagesRef.current = {};
    setProjectMaterials([]);
    setPipelineStage("queued");
    setPipelineProgress(null);

    try {
      // 1. Create the project doc up front so it appears in "past projects" and
      //    the workspace can start showing progress immediately.
      const docRef = await addDoc(collection(db, "projects"), {
        uid: user.uid,
        title: "Optiq Skills at work…",
        concept: promptText,
        length,
        brandName: brandName || "Client",
        product: product || "Product offering",
        aspectRatio,
        scenes: [],
        styleHeader: "",
        characterLock: "",
        videoStatus: {},
        productionMode: productionMode || "manual",
        pipelineStage: "queued",
        pipelineError: null,
        // An ad is one price: the spec payment covers every scene render, so
        // the project carries an allowance the render endpoint draws down.
        prepaidRenders: length === "30s" ? 3 : length === "60s" ? 6 : 9,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      const projectId = docRef.id;
      setActiveProjectId(projectId);
      setRouteProjectId(projectId);
      router.push(`/dashboard/project/${projectId}`);

      // 2. Upload brand materials, then record them on the project.
      const uploadedMaterials = await uploadBrandMaterials(projectId);
      if (uploadedMaterials.length > 0) {
        setProjectMaterials(uploadedMaterials);
        await updateDoc(doc(db, "projects", projectId), { materials: uploadedMaterials });
      }

      // 3. Enqueue the cloud job. Everything else happens server-side.
      await addDoc(collection(db, "storyboardJobs"), {
        uid: user.uid,
        projectId,
        prompt: promptText,
        length,
        brandName: brandName || "Client",
        product: product || "Product offering",
        aspectRatio,
        productionMode: productionMode || "manual",
        materialPaths: uploadedMaterials,
        status: "queued",
        createdAt: new Date().toISOString(),
      });
      // Generation continues in the cloud; the hydration effect flips the UI
      // out of "generating" once the project doc reaches a terminal stage.
    } catch (err) {
      console.error("Failed to enqueue storyboard generation:", err);
      setError(err instanceof Error ? err.message : "Could not start storyboard generation");
      setGenerating(false);
      setPipelineStage("failed");
    }
  }, [
    promptText,
    user,
    length,
    brandName,
    product,
    aspectRatio,
    productionMode,
    router,
    uploadBrandMaterials,
  ]);

  // Retry a failed cloud generation on the SAME project (free — the spec was
  // already paid for). Re-enqueues a fresh job from the project's stored brief.
  const retryStoryboard = useCallback(async () => {
    if (!user || !activeProjectId) return;
    setError(null);
    setStoryboard(null);
    setGenerating(true);
    setPipelineStage("queued");
    setPipelineProgress(null);
    try {
      await updateDoc(doc(db, "projects", activeProjectId), {
        pipelineStage: "queued",
        pipelineError: null,
        updatedAt: new Date().toISOString(),
      });
      await addDoc(collection(db, "storyboardJobs"), {
        uid: user.uid,
        projectId: activeProjectId,
        prompt: promptText,
        length,
        brandName: brandName || "Client",
        product: product || "Product offering",
        aspectRatio,
        productionMode: productionMode || "manual",
        materialPaths: projectMaterials,
        status: "queued",
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.error("Failed to retry storyboard generation:", err);
      setError(err instanceof Error ? err.message : "Could not restart generation");
      setGenerating(false);
      setPipelineStage("failed");
    }
  }, [user, activeProjectId, promptText, length, brandName, product, aspectRatio, productionMode, projectMaterials]);

  // ─── AUTO-RESUME OR INITIATE QUEUED GENERATIONS ON PROJECT LOAD ──────────
  useEffect(() => {
    if (!storyboard || !activeProjectId) return;
    storyboard.scenes.forEach((scene, idx) => {
      const status = videoStatus[idx];
      const isPolling = !!(window as any)[`_scene_poll_${idx}`];
      if (!status || status.status === "succeeded" || status.status === "failed") return;
      if (status.status === "rendering" && status.id && !isPolling) {
        void resumePollingForScene(idx, status.id);
      } else if (
        productionMode === "auto-merge" &&
        (status.status === "idle" || (status.status === "rendering" && !status.id)) &&
        !isPolling
      ) {
        void generateVideoForScene(idx, scene.fullPrompt);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyboard, activeProjectId, productionMode]);

  const reviseScenePrompt = useCallback(
    async (sceneIndex: number) => {
      if (!storyboard) return;
      const scene = storyboard.scenes[sceneIndex];
      const status = videoStatus[sceneIndex];
      if (!status?.revisionInput?.trim()) return;

      setVideoStatus((prev) => ({
        ...prev,
        [sceneIndex]: { ...prev[sceneIndex], revising: true },
      }));

      try {
        const res = await apiFetch<{ revisedPrompt: string }>("/api/story/revise", {
          method: "POST",
          body: JSON.stringify({
            scenePrompt: scene.fullPrompt,
            revisionRequest: status.revisionInput,
            characterLock: storyboard.characterLock,
            styleHeader: storyboard.styleHeader,
            // Continuity context: the reviser keeps this scene flowing from the
            // one before it and into the one after it, on the same music bed.
            previousScenePrompt: storyboard.scenes[sceneIndex - 1]?.fullPrompt || null,
            nextScenePrompt: storyboard.scenes[sceneIndex + 1]?.fullPrompt || null,
            musicSpec: storyboard.musicSpec || null,
          }),
        });

        const updatedScenes = [...storyboard.scenes];
        updatedScenes[sceneIndex] = {
          ...scene,
          fullPrompt: res.revisedPrompt,
          action: `[REVISED] ${scene.action}`,
        };
        setStoryboard({ ...storyboard, scenes: updatedScenes });

        setVideoStatus((prev) => ({
          ...prev,
          [sceneIndex]: {
            ...prev[sceneIndex],
            revising: false,
            revisionInput: "",
            customPrompt: res.revisedPrompt,
          },
        }));
      } catch (err) {
        alert("Revision failed: " + (err instanceof Error ? err.message : String(err)));
        setVideoStatus((prev) => ({
          ...prev,
          [sceneIndex]: { ...prev[sceneIndex], revising: false },
        }));
      }
    },
    [storyboard, videoStatus, apiFetch]
  );

  // ─── PER-SCENE REFERENCE IMAGE MANAGEMENT ────────────────────────────────
  const updateSceneImages = useCallback((sceneIndex: number, next: SceneImage[]) => {
    setSceneImages((prev) => {
      const map = { ...prev, [sceneIndex]: next };
      sceneImagesRef.current = map;
      return map;
    });
  }, []);

  const addSceneImages = useCallback(
    async (sceneIndex: number, files: FileList | File[]) => {
      if (!user || !activeProjectId) return;
      const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (list.length === 0) return;
      try {
        const uploaded = await Promise.all(
          list.map(async (file) => {
            const safeName = file.name.replace(/[^\w.-]/g, "_");
            const path = `users/${user.uid}/projects/${activeProjectId}/materials/${Date.now()}-${safeName}`;
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });
            const fileRef = storageRef(storage, path);
            await uploadString(fileRef, dataUrl, "data_url");
            const url = await getDownloadURL(fileRef);
            return { name: file.name, path, url, mimeType: file.type } as SceneImage;
          })
        );
        setProjectMaterials((prev) => [...prev, ...uploaded]);
        updateSceneImages(sceneIndex, [...(sceneImagesRef.current[sceneIndex] || []), ...uploaded]);
      } catch (err) {
        console.error("Failed to upload scene reference images:", err);
        alert("Image upload failed. Please try again.");
      }
    },
    [user, activeProjectId, updateSceneImages]
  );

  const attachMaterialToScene = useCallback(
    (sceneIndex: number, material: SceneImage) => {
      const current = sceneImagesRef.current[sceneIndex] || [];
      if (current.some((img) => img.path === material.path)) return;
      updateSceneImages(sceneIndex, [...current, material]);
    },
    [updateSceneImages]
  );

  const removeSceneImage = useCallback(
    (sceneIndex: number, imageIndex: number) => {
      const current = sceneImagesRef.current[sceneIndex] || [];
      updateSceneImages(sceneIndex, current.filter((_, i) => i !== imageIndex));
    },
    [updateSceneImages]
  );

  const copyToClipboard = useCallback((text: string, index: number) => {
    void navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  }, []);

  const value: EditorFlowValue = {
    user,
    profile,
    storyboardPayOpen, setStoryboardPayOpen,
    paywallStep, setPaywallStep,
    productionMode, setProductionMode,
    theaterPlaying, setTheaterPlaying,
    currentScenePlayIdx, setCurrentScenePlayIdx,
    projects, projectsLoading, activeProjectId,
    compileStatus, compileVideoUrl, compileError,
    timeline, setTimeline,
    musicUrl, setMusicUrl,
    musicVolume, setMusicVolume,
    wizardStep, setWizardStep,
    length, setLength,
    promptText, setPromptText,
    brandName, setBrandName,
    product, setProduct,
    brandMaterials, isDragging, setIsDragging,
    promptExpanded, setPromptExpanded,
    aspectRatio, setAspectRatio,
    aspectDropdownOpen, setAspectDropdownOpen,
    recording, recordingTarget, generating, error, setError, copiedIndex,
    storyboard, setStoryboard,
    videoStatus, setVideoStatus,
    pipelineStage, pipelineProgress, retryStoryboard,
    sceneImages, projectMaterials,
    addSceneImages, attachMaterialToScene, removeSceneImage,
    startSpeechRecognition, stopSpeechRecognition,
    handleMaterialsUpload, handleDrop, removeBrandMaterial,
    generateStoryboard, generateVideoForScene, reviseScenePrompt,
    copyToClipboard, handleCompileProject, deleteProject,
    goHome, goCreate, openProject, openProjectRoute,
  };

  return <EditorFlowContext.Provider value={value}>{children}</EditorFlowContext.Provider>;
}
