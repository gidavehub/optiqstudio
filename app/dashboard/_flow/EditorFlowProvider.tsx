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
import { db } from "../../../lib/firebase";
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
import {
  BrandMaterial,
  ProductionMode,
  ProjectLength,
  Storyboard,
  VideoStatusMap,
  STORYBOARD_TEMPLATES,
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
  ccName: string; setCcName: (v: string) => void;
  ccNumber: string; setCcNumber: (v: string) => void;
  ccExpiry: string; setCcExpiry: (v: string) => void;
  ccCvv: string; setCcCvv: (v: string) => void;
  ccError: string | null; setCcError: (v: string | null) => void;
  ccPaying: boolean; setCcPaying: (v: boolean) => void;
  ccPayMessage: string; setCcPayMessage: (v: string) => void;
  ccCompleted: boolean; setCcCompleted: (v: boolean) => void;
  ccSpotCheckout: boolean; setCcSpotCheckout: (v: boolean) => void;

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
  wizardStep: 1 | 2 | 3;
  setWizardStep: (v: 1 | 2 | 3) => void;
  selectedTemplateIdx: number | null;
  setSelectedTemplateIdx: (v: number | null) => void;
  length: ProjectLength; setLength: (v: ProjectLength) => void;
  promptText: string; setPromptText: (v: string) => void;
  brandName: string; setBrandName: (v: string) => void;
  product: string; setProduct: (v: string) => void;
  hasCharacter: boolean; setHasCharacter: (v: boolean) => void;
  characterName: string; setCharacterName: (v: string) => void;
  characterDesc: string; setCharacterDesc: (v: string) => void;
  brandMaterials: BrandMaterial[];
  isDragging: boolean; setIsDragging: (v: boolean) => void;

  // Prompt bar styling
  promptExpanded: boolean; setPromptExpanded: (v: boolean) => void;
  aspectRatio: string; setAspectRatio: (v: string) => void;
  aspectDropdownOpen: boolean; setAspectDropdownOpen: (v: boolean) => void;

  // Interaction
  recording: boolean;
  generating: boolean;
  error: string | null; setError: (v: string | null) => void;
  copiedIndex: number | null;

  // Storyboard + scene statuses
  storyboard: Storyboard | null;
  setStoryboard: React.Dispatch<React.SetStateAction<Storyboard | null>>;
  videoStatus: VideoStatusMap;
  setVideoStatus: React.Dispatch<React.SetStateAction<VideoStatusMap>>;

  // Handlers
  startSpeechRecognition: () => void;
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
  const [ccName, setCcName] = useState("");
  const [ccNumber, setCcNumber] = useState("");
  const [ccExpiry, setCcExpiry] = useState("");
  const [ccCvv, setCcCvv] = useState("");
  const [ccError, setCcError] = useState<string | null>(null);
  const [ccPaying, setCcPaying] = useState(false);
  const [ccPayMessage, setCcPayMessage] = useState("");
  const [ccCompleted, setCcCompleted] = useState(false);
  const [ccSpotCheckout, setCcSpotCheckout] = useState(false);

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
  const [musicVolume, setMusicVolume] = useState<number>(0.2);

  // Wizard
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [selectedTemplateIdx, setSelectedTemplateIdx] = useState<number | null>(null);
  const [length, setLength] = useState<ProjectLength>("30s");
  const [promptText, setPromptText] = useState("");
  const [brandName, setBrandName] = useState("");
  const [product, setProduct] = useState("");
  const [hasCharacter, setHasCharacter] = useState(true);
  const [characterName, setCharacterName] = useState("");
  const [characterDesc, setCharacterDesc] = useState("");
  const [brandMaterials, setBrandMaterials] = useState<BrandMaterial[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const [promptExpanded, setPromptExpanded] = useState(false);
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [aspectDropdownOpen, setAspectDropdownOpen] = useState(false);

  const [recording, setRecording] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [videoStatus, setVideoStatus] = useState<VideoStatusMap>({});

  // ─── PROJECT STATE LOADER (no navigation) ─────────────────────────────────
  const loadProjectState = useCallback((proj: any) => {
    setStoryboard({
      title: proj.title,
      concept: proj.concept,
      styleHeader: proj.styleHeader || "",
      characterLock: proj.characterLock || { name: "", description: "", wardrobe: "" },
      scenes: proj.scenes,
    });
    setLength(proj.length);
    setBrandName(proj.brandName || "");
    setProduct(proj.product || "");
    setHasCharacter(proj.hasCharacter ?? true);
    setCharacterName(proj.characterName || "");
    setCharacterDesc(proj.characterDesc || "");
    setVideoStatus(proj.videoStatus || {});
    setActiveProjectId(proj.id);
    setProductionMode(proj.productionMode || "manual");
    setCompileStatus(proj.compileStatus || "idle");
    setCompileVideoUrl(proj.compileVideoUrl || "");
    setCompileError(proj.compileError || "");
    setTimeline(proj.timeline || []);
    setMusicUrl(proj.musicUrl || "");
    setMusicVolume(proj.musicVolume ?? 0.2);
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
            productionMode: productionMode || "manual",
            compileStatus,
            compileVideoUrl,
            compileError,
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
    compileStatus,
    compileVideoUrl,
    compileError,
    timeline,
    musicUrl,
    musicVolume,
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

  // Sync template selection index with the active prompt text
  useEffect(() => {
    if (!promptText.trim()) {
      setSelectedTemplateIdx(null);
    } else {
      const matchIdx = STORYBOARD_TEMPLATES.findIndex((item) => item.concept === promptText);
      setSelectedTemplateIdx(matchIdx !== -1 ? matchIdx : null);
    }
  }, [promptText]);

  const startSpeechRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please type your prompt.");
      return;
    }
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";
    const initialText = promptText;
    rec.onstart = () => setRecording(true);
    rec.onresult = (e: any) => {
      let sessionText = "";
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) sessionText += e.results[i][0].transcript + " ";
      }
      const trimmed = sessionText.trim();
      if (trimmed) setPromptText(initialText ? `${initialText} ${trimmed}` : trimmed);
    };
    rec.onerror = (e: any) => {
      console.error("Speech recognition error:", e);
      setRecording(false);
    };
    rec.onend = () => setRecording(false);
    (window as any)._rec = rec;
    rec.start();
  }, [promptText]);

  const stopSpeechRecognition = useCallback(() => {
    if ((window as any)._rec) (window as any)._rec.stop();
    setRecording(false);
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
        const res = await apiFetch<{ id: string }>("/api/video/generate", {
          method: "POST",
          body: JSON.stringify({
            prompt: promptTextArg,
            model: "omni",
            aspectRatio: "16:9",
            durationSeconds: 10,
            generateAudio: true,
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
    [apiFetch, refreshProfile]
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

  // Trigger Storyboard Generation
  const generateStoryboard = useCallback(async () => {
    if (!promptText.trim()) {
      alert("Please describe your campaign or video pitch.");
      return;
    }

    setGenerating(true);
    setError(null);
    setStoryboard(null);

    let preDocId = "";

    if (user) {
      try {
        const docRef = await addDoc(collection(db, "projects"), {
          uid: user.uid,
          title: "Analyzing Campaign Concept...",
          concept: promptText,
          length,
          brandName: brandName || "Client",
          product: product || "Product offering",
          hasCharacter,
          characterName: hasCharacter ? characterName : "No recurring main character",
          characterDesc: hasCharacter ? characterDesc : "Different people featured in separate scenes",
          scenes: [],
          styleHeader: "",
          characterLock: "",
          videoStatus: {},
          productionMode: productionMode || "manual",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        preDocId = docRef.id;
        setActiveProjectId(preDocId);
        setRouteProjectId(preDocId);
        router.push(`/dashboard/project/${preDocId}`);
      } catch (dbErr) {
        console.error("Failed to pre-create project:", dbErr);
      }
    }

    try {
      const audioContinuityDirective = `
\n\n[AUDIO CONTINUITY & CINEMATIC AUDIO UNIFORMITY DIRECTIVE]:
To ensure professional commercial grade continuity, you must maintain a uniform audio backdrop across all scenes.
Determine one consistent background music track (e.g. "Upbeat acoustic folk with native Gambian kora accents", "Modern clean electronic synth-pop beats", or "Warm cinematic string orchestra") and specify this identical track in the "audioCues" of EVERY scene.
Similarly, determine a uniform ambient noise level (e.g. "Gentle coastal wind and soft rustling waves", "Faint distant street market chattering", or "Quiet modern office ambiance") and carry it continuously frame-to-frame.
The voice-over and dialogue tone should remain tightly synchronized in style, speaker accent, and pacing across the entire run-time.
`;
      const data = await apiFetch<Storyboard>("/api/story/generate", {
        method: "POST",
        body: JSON.stringify({
          prompt:
            (selectedTemplateIdx !== null
              ? `${promptText}\n\n[STYLE LOCK DIRECTIVE]: This is a pre-built campaign template. You must base the entire storyboard, styling, tone, and visual direction precisely on the "${STORYBOARD_TEMPLATES[selectedTemplateIdx].subtitle}" style and the concept described above. Keep the visuals, pacing, lighting, and aesthetic tightly aligned with this specific theme.`
              : promptText) + audioContinuityDirective,
          length,
          brandName: brandName || "Client",
          product: product || "Product offering",
          characterName: hasCharacter
            ? characterName
            : "No recurring main character (Multiple different people featured in various scenes interacting around the product)",
          characterDesc: hasCharacter
            ? characterDesc
            : "Different people, community members, or customers featured in separate scenes, no single locked actor face",
          logo: brandMaterials.length > 0 ? brandMaterials[0].data : null,
        }),
      });

      setStoryboard(data);

      const initialStatus: VideoStatusMap = {};
      data.scenes.forEach((_, idx) => {
        initialStatus[idx] = { status: "idle", revisionInput: "", customPrompt: "" };
      });
      setVideoStatus(initialStatus);

      if (preDocId) {
        try {
          const projectDocRef = doc(db, "projects", preDocId);
          await updateDoc(projectDocRef, {
            title: data.title,
            concept: data.concept,
            scenes: data.scenes,
            styleHeader: data.styleHeader || "",
            characterLock: data.characterLock || "",
            videoStatus: initialStatus,
            updatedAt: new Date().toISOString(),
          });
        } catch (dbErr) {
          console.error("Failed to update Firestore project document with spec:", dbErr);
        }
      }

      if (productionMode === "auto-merge") {
        data.scenes.forEach((scene, idx) => {
          void generateVideoForScene(idx, scene.fullPrompt);
        });
      }
    } catch (err) {
      console.error("Storyboard generation endpoint error:", err);
      setError(err instanceof Error ? err.message : "Storyboard generation failed");
    } finally {
      setGenerating(false);
    }
  }, [
    promptText,
    user,
    length,
    brandName,
    product,
    hasCharacter,
    characterName,
    characterDesc,
    productionMode,
    selectedTemplateIdx,
    brandMaterials,
    apiFetch,
    router,
    generateVideoForScene,
  ]);

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
    ccName, setCcName,
    ccNumber, setCcNumber,
    ccExpiry, setCcExpiry,
    ccCvv, setCcCvv,
    ccError, setCcError,
    ccPaying, setCcPaying,
    ccPayMessage, setCcPayMessage,
    ccCompleted, setCcCompleted,
    ccSpotCheckout, setCcSpotCheckout,
    projects, projectsLoading, activeProjectId,
    compileStatus, compileVideoUrl, compileError,
    timeline, setTimeline,
    musicUrl, setMusicUrl,
    musicVolume, setMusicVolume,
    wizardStep, setWizardStep,
    selectedTemplateIdx, setSelectedTemplateIdx,
    length, setLength,
    promptText, setPromptText,
    brandName, setBrandName,
    product, setProduct,
    hasCharacter, setHasCharacter,
    characterName, setCharacterName,
    characterDesc, setCharacterDesc,
    brandMaterials, isDragging, setIsDragging,
    promptExpanded, setPromptExpanded,
    aspectRatio, setAspectRatio,
    aspectDropdownOpen, setAspectDropdownOpen,
    recording, generating, error, setError, copiedIndex,
    storyboard, setStoryboard,
    videoStatus, setVideoStatus,
    startSpeechRecognition, stopSpeechRecognition,
    handleMaterialsUpload, handleDrop, removeBrandMaterial,
    generateStoryboard, generateVideoForScene, reviseScenePrompt,
    copyToClipboard, handleCompileProject, deleteProject,
    goHome, goCreate, openProject, openProjectRoute,
  };

  return <EditorFlowContext.Provider value={value}>{children}</EditorFlowContext.Provider>;
}
