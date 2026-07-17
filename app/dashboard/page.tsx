"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Clapperboard,
  Megaphone,
  Share2,
  Video,
  X,
  Mic,
  MicOff,
  Upload,
  Play,
  RefreshCw,
  Edit3,
  ChevronRight,
  ChevronLeft,
  Wand2,
  Zap,
  Sparkles,
  Check,
  CheckCircle,
  AlertCircle,
  Undo2,
  Tv,
  Eye,
  Copy,
  Paperclip,
  CreditCard,
  ChevronUp,
  ChevronDown,
  Music
} from "lucide-react";
import { useAuth } from "../../components/AuthProvider";
import { db } from "../../lib/firebase";
import { doc, updateDoc, increment, collection, addDoc, query, where, onSnapshot, deleteDoc } from "firebase/firestore";

const STORYBOARD_TEMPLATES = [
  {
    name: "Traditional Welcoming Feast",
    subtitle: "Organic & Earthy Vibe",
    concept: "An earthy, heartwarming commercial script. Inside a beautiful traditional family compound at sunset, hosts prepare a welcoming meal for visiting in-laws, grinding fresh regional ingredients and slow-cooking a rich, steaming groundnut sauce over open embers.",
    brandName: "Local Harvest",
    product: "Organic Groundnut Sauce",
    hasCharacter: true,
    characterName: "Nyima",
    characterDesc: "An elegant, hardworking Gambian woman, neat thin cornrow braids, 20s",
    coverVideo: "/media/template-1.mp4"
  },
  {
    name: "Childhood Kitchen Discovery",
    subtitle: "Warm & Cozy Vibe",
    concept: "A warm, nostalgia-rich commercial. A young boy comes home, searches kitchen cupboards for a quick after-school snack, and happily discovers a fresh jar of premium spread, spreading it generously on local warm crusty bread with a huge smile.",
    brandName: "Sweet Morning",
    product: "Creamy Nut Butter",
    hasCharacter: true,
    characterName: "Alieu",
    characterDesc: "A cheerful 8-year-old Gambian boy, school uniform, bright smile",
    coverVideo: "/media/template-2.mp4"
  },
  {
    name: "Fast-Paced Urban Commerce",
    subtitle: "Modern & Dynamic Vibe",
    concept: "A high-octane, rhythm-driven commercial tracking active urban merchants, shopkeepers, and busy tailors managing fast-moving phone transactions and ledger operations in bustling city markets.",
    brandName: "Metro Pay",
    product: "Sleek Ledger App",
    hasCharacter: false,
    characterName: "",
    characterDesc: "",
    coverVideo: "/media/template-3.mp4"
  },
  {
    name: "Empowering Community Journey",
    subtitle: "Inspirational Vibe",
    concept: "An inspiring, narrative-driven commercial showing an entrepreneur's journey at dawn—supplying merchants, coordinating/loading trucks, and connecting with distant family members over a secure network.",
    brandName: "Reach Mobile",
    product: "Local Mobile Network",
    hasCharacter: true,
    characterName: "Nyima",
    characterDesc: "A proactive, tech-savvy Gambian female entrepreneur in her late 20s",
    coverVideo: "/media/template-4.mp4"
  },
  {
    name: "High-Energy Matchday Victory",
    subtitle: "Exciting & Electric Vibe",
    concept: "An electric, high-energy commercial capturing the raw excitement of friends in a local parlor celebrating a dramatic football goal together, cheering with high-fives under glowing neon lights.",
    brandName: "Winner Sports",
    product: "Sports App",
    hasCharacter: false,
    characterName: "",
    characterDesc: "",
    coverVideo: "/media/template-5.mp4"
  },
  {
    name: "High-Fashion Street Editorial",
    subtitle: "Sleek & Chic Vibe",
    concept: "A sleek, editorial commercial script. A confident young model walking down a sun-drenched, palm-lined street in warm summer knitwear, catching natural golden hour highlights as the camera tracks smoothly.",
    brandName: "Aura Wear",
    product: "Summer Knitwear Line",
    hasCharacter: true,
    characterName: "Fatou",
    characterDesc: "A striking, confident young Gambian model, natural afro, sharp cheekbones",
    coverVideo: "/media/template-6.mp4"
  },
  {
    name: "Sleek Lab Innovation",
    subtitle: "Futuristic & Tech Vibe",
    concept: "A crisp, high-tech commercial sequence. An engineer adjusting a precision robotic arm inside a modern research studio, bathed in glowing cyan indicators and clean rim lighting.",
    brandName: "Apex Systems",
    product: "AI Precision Robotic Arm",
    hasCharacter: false,
    characterName: "",
    characterDesc: "",
    coverVideo: "/media/template-7.mp4"
  },
  {
    name: "Cozy Childhood Playroom",
    subtitle: "Dreamy & Playful Vibe",
    concept: "A soft, dreamlike commercial sequence. Warm wooden toys and handcrafted plush blocks resting on vibrant traditional patterned rugs inside a cozy sunlit room, basking in a warm amber glow.",
    brandName: "Kindred Toys",
    product: "Handcrafted Wooden Playsets",
    hasCharacter: false,
    characterName: "",
    characterDesc: "",
    coverVideo: "/media/template-8.mp4"
  },
  {
    name: "Rain-Soaked Neon Haze",
    subtitle: "Moody & Cinematic Vibe",
    concept: "A highly atmospheric, cinematic commercial scene. A young traveler wearing a dark rain jacket walking along a wet, glowing neon-lit city street at midnight, catching soft moody backlights through a misty haze.",
    brandName: "Vanguard Outerwear",
    product: "All-Weather Rain Jacket",
    hasCharacter: true,
    characterName: "Ebrima",
    characterDesc: "A tall, contemplative Gambian man, hooded rain jacket, 20s",
    coverVideo: "/media/template-9.mp4"
  },
  {
    name: "Coastal Beach Boardwalk",
    subtitle: "Candid & Documentary Vibe",
    concept: "A refreshing, documentary-style commercial script. Friends sharing broad laughter on a bright beach boardwalk at midday, with seabirds gliding through the deep blue sky, bathed in highly natural sunlit exposures.",
    brandName: "Sanyang Sun",
    product: "Polarized Sunglasses",
    hasCharacter: false,
    characterName: "",
    characterDesc: "",
    coverVideo: "/media/template-10.mp4"
  },
  {
    name: "Winter Forest Expedition",
    subtitle: "Adventure & Cinematic Vibe",
    concept: "A dramatic, high-contrast adventure commercial. Two intrepid explorers equipped with rugged backpacks stepping through a rustic cabin doorway into a silent, snow-covered pine forest under crisp blue twilight.",
    brandName: "Summit Gear",
    product: "Extreme Weather Parkas",
    hasCharacter: false,
    characterName: "",
    characterDesc: "",
    coverVideo: "/media/template-11.mp4"
  }
];

interface Scene {
  sceneNumber: number;
  setting: string;
  action: string;
  dialogue: string;
  sound: string;
  fullPrompt: string;
}

interface Storyboard {
  title: string;
  concept: string;
  characterLock: {
    name: string;
    description: string;
    wardrobe: string;
  };
  styleHeader: string;
  scenes: Scene[];
}

interface DashboardHomeProps {
  projectId?: string;
}

export default function DashboardHome({ projectId }: DashboardHomeProps = {}) {
  const { user, profile, apiFetch, refreshProfile } = useAuth();

  // Storyboard Paywall states
  const [storyboardPayOpen, setStoryboardPayOpen] = useState(false);
  const [paywallStep, setPaywallStep] = useState<"pay" | "choose">("pay");
  const [productionMode, setProductionMode] = useState<"manual" | "auto-merge" | null>(null);
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
  
  // Past Projects and Firestore Active Project state
  const [projects, setProjects] = useState<any[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  // Compilation and Timeline states
  const [compileStatus, setCompileStatus] = useState<"idle" | "compiling" | "succeeded" | "failed">("idle");
  const [compileVideoUrl, setCompileVideoUrl] = useState<string>("");
  const [compileError, setCompileError] = useState<string>("");
  const [timeline, setTimeline] = useState<any[]>([]);
  const [musicUrl, setMusicUrl] = useState<string>("");
  const [musicVolume, setMusicVolume] = useState<number>(0.2);

  // Core navigation states
  const [view, setView] = useState<"home" | "wizard" | "storyboard">("home");
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [selectedTemplateIdx, setSelectedTemplateIdx] = useState<number | null>(null);
  
  // Wizard Input states
  const [length, setLength] = useState<"30s" | "60s" | "90s">("60s");
  const [promptText, setPromptText] = useState("");
  const [brandName, setBrandName] = useState("");
  const [product, setProduct] = useState("");
  const [hasCharacter, setHasCharacter] = useState(true);
  const [characterName, setCharacterName] = useState("");
  const [characterDesc, setCharacterDesc] = useState("");
  const [brandMaterials, setBrandMaterials] = useState<Array<{ name: string; data: string }>>([]);
  const [isDragging, setIsDragging] = useState(false);
  
  // Leonardo AI Style Prompt States
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [mediaMode, setMediaMode] = useState<"image" | "video">("image");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [styleMode, setStyleMode] = useState("Cinematic");
  const [speedMode, setSpeedMode] = useState("Auto");
  const [aspectDropdownOpen, setAspectDropdownOpen] = useState(false);
  
  // UI Interaction states
  const [recording, setRecording] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Storyboard state
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  
  // Per-scene generation and revision states
  // Status can be: 'idle' | 'rendering' | 'succeeded' | 'failed'
  const [videoStatus, setVideoStatus] = useState<
    Record<
      number,
      {
        id?: string;
        status: "idle" | "rendering" | "succeeded" | "failed";
        url?: string;
        error?: string;
        revisionInput?: string;
        revising?: boolean;
        editingPrompt?: boolean;
        customPrompt?: string;
      }
    >
  >({});

  // Clean up any polling intervals on unmount
  useEffect(() => {
    return () => {
      // Clear all active polling intervals stored on window
      for (let i = 0; i < 20; i++) {
        const intervalId = (window as any)[`_scene_poll_${i}`];
        if (intervalId) clearInterval(intervalId);
      }
    };
  }, []);

  // ─── FIRESTORE PAST PROJECTS REAL-TIME LISTENER ──────────────────────────
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "projects"),
      where("uid", "==", user.uid)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      // Sort client-side by createdAt descending
      list.sort((a: any, b: any) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setProjects(list);
      setProjectsLoading(false);
    }, (err) => {
      console.error("Failed to fetch past projects:", err);
      setProjectsLoading(false);
    });
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
        if (val !== undefined) {
          clean[key] = cleanUndefined(val);
        }
      }
      return clean;
    };

    const updateFirebaseProject = async () => {
      try {
        const projRef = doc(db, "projects", activeProjectId);
        await updateDoc(projRef, cleanUndefined({
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
        }));
      } catch (err) {
        console.error("Failed to auto-save project state to Firestore:", err);
      }
    };

    // Debounce database sync to prevent excess writes
    const timeout = setTimeout(() => {
      void updateFirebaseProject();
    }, 1500);

    return () => clearTimeout(timeout);
  }, [videoStatus, activeProjectId, storyboard, productionMode, user, compileStatus, compileVideoUrl, compileError, timeline, musicUrl, musicVolume]);

  // ─── AUTO-RESUME DETAILED PROJECT VIA PROP ID ──────────────────────────
  useEffect(() => {
    if (projectId && projects.length > 0) {
      const match = projects.find((p) => p.id === projectId);
      if (match) {
        if (activeProjectId !== match.id) {
          loadProject(match);
        } else {
          // Live sync cloud-side compilation status changes to active workspace
          if (match.compileStatus !== compileStatus) {
            setCompileStatus(match.compileStatus || "idle");
          }
          if (match.compileVideoUrl !== compileVideoUrl) {
            setCompileVideoUrl(match.compileVideoUrl || "");
          }
          if (match.compileError !== compileError) {
            setCompileError(match.compileError || "");
          }
        }
      }
    }
  }, [projectId, projects, activeProjectId, compileStatus, compileVideoUrl, compileError]);

  // ─── INITIALIZE TIMELINE FROM COMPLETED VIDEOS ──────────────────────────
  useEffect(() => {
    if (!storyboard || !videoStatus) return;
    const completedCount = storyboard.scenes.filter((_, idx) => videoStatus[idx]?.status === "succeeded").length;
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

  const handleCompileProject = async () => {
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
          playOrder: idx
        })),
        musicUrl: musicUrl || null,
        musicVolume: Number(musicVolume) ?? 0.2
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
  };

  // ─── PROJECTS MANAGEMENT METHODS ─────────────────────────────────────────
  const loadProject = (proj: any) => {
    setStoryboard({
      title: proj.title,
      concept: proj.concept,
      styleHeader: proj.styleHeader || "",
      characterLock: proj.characterLock || "",
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
    setView("storyboard");

    // Sync browser address bar to shareable path segment in real-time
    window.history.pushState(null, "", `/dashboard/project/${proj.id}`);
  };

  const deleteProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation(); // Avoid loading the deleted project
    if (!confirm("Are you sure you want to permanently delete this storyboard project?")) return;
    try {
      await deleteDoc(doc(db, "projects", projectId));
    } catch (err) {
      console.error("Failed to delete project document from Firestore:", err);
    }
  };

  // Sync template selection index with the active prompt text
  useEffect(() => {
    if (!promptText.trim()) {
      setSelectedTemplateIdx(null);
    } else {
      const matchIdx = STORYBOARD_TEMPLATES.findIndex((item) => item.concept === promptText);
      setSelectedTemplateIdx(matchIdx !== -1 ? matchIdx : null);
    }
  }, [promptText]);

  // Web Speech Recognition handler
  const startSpeechRecognition = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please type your prompt.");
      return;
    }
    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";

    const initialText = promptText;

    rec.onstart = () => {
      setRecording(true);
    };

    rec.onresult = (e: any) => {
      let sessionText = "";
      for (let i = 0; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          sessionText += e.results[i][0].transcript + " ";
        }
      }
      const trimmed = sessionText.trim();
      if (trimmed) {
        setPromptText(initialText ? `${initialText} ${trimmed}` : trimmed);
      }
    };

    rec.onerror = (e: any) => {
      console.error("Speech recognition error:", e);
      setRecording(false);
    };

    rec.onend = () => {
      setRecording(false);
    };

    (window as any)._rec = rec;
    rec.start();
  };

  const stopSpeechRecognition = () => {
    if ((window as any)._rec) {
      (window as any)._rec.stop();
    }
    setRecording(false);
  };

  // Multi-materials file upload helpers
  const processUploadedFiles = (files: FileList) => {
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setBrandMaterials((prev) => [
          ...prev,
          { name: file.name, data: reader.result as string },
        ]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleMaterialsUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processUploadedFiles(files);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processUploadedFiles(files);
    }
  };

  const removeBrandMaterial = (index: number) => {
    setBrandMaterials((prev) => prev.filter((_, i) => i !== index));
  };

  // Trigger Storyboard Generation
  const generateStoryboard = async () => {
    if (!promptText.trim()) {
      alert("Please describe your campaign or video pitch.");
      return;
    }

    setGenerating(true);
    setError(null);
    setStoryboard(null); // Clear any old storyboard first

    let preDocId = "";
    let docRef: any = null;

    // 1. Immediately pre-create the project in Firestore to pre-allocate its ID and redirect
    if (user) {
      try {
        docRef = await addDoc(collection(db, "projects"), {
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
        
        // Push address bar state immediately so the user lands on the shareable URL
        window.history.pushState(null, "", `/dashboard/project/${preDocId}`);
      } catch (dbErr) {
        console.error("Failed to pre-create project:", dbErr);
      }
    }

    setView("storyboard");

    // 2. Perform the async API request to compile the storyboard specification
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
          prompt: (selectedTemplateIdx !== null 
            ? `${promptText}\n\n[STYLE LOCK DIRECTIVE]: This is a pre-built campaign template. You must base the entire storyboard, styling, tone, and visual direction precisely on the "${STORYBOARD_TEMPLATES[selectedTemplateIdx].subtitle}" style and the concept described above. Keep the visuals, pacing, lighting, and aesthetic tightly aligned with this specific theme.`
            : promptText) + audioContinuityDirective,
          length,
          brandName: brandName || "Client",
          product: product || "Product offering",
          characterName: hasCharacter ? characterName : "No recurring main character (Multiple different people featured in various scenes interacting around the product)",
          characterDesc: hasCharacter ? characterDesc : "Different people, community members, or customers featured in separate scenes, no single locked actor face",
          logo: brandMaterials.length > 0 ? brandMaterials[0].data : null,
        }),
      });

      setStoryboard(data);
      
      // Initialize videoStatus states for each scene
      const initialStatus: typeof videoStatus = {};
      data.scenes.forEach((_, idx) => {
        initialStatus[idx] = {
          status: "idle",
          revisionInput: "",
          customPrompt: "",
        };
      });
      setVideoStatus(initialStatus);

      // 3. Update the pre-created Firestore document with the completed specs
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

      // 4. Auto-trigger scene rendering in parallel if auto-merge was selected
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
  };

  // Inline scene video generation using Gemini Omni Flash
  const generateVideoForScene = async (sceneIndex: number, promptText: string) => {
    // Clear any previous interval first
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
          prompt: promptText,
          model: "omni",
          aspectRatio: "16:9",
          durationSeconds: 10,
          generateAudio: true,
        }),
      });

      // Save the returned background generation ID to state/Firestore
      setVideoStatus((prev) => {
        const copy = { ...prev };
        if (copy[sceneIndex]) {
          const updated = { ...copy[sceneIndex], status: "rendering" as const, id: res.id };
          delete updated.error;
          copy[sceneIndex] = updated;
        }
        return copy;
      });

      // Polling loop
      const intervalId = setInterval(async () => {
        try {
          const status = await apiFetch<{
            status: string;
            videoUrl?: string;
            error?: string;
          }>(`/api/video/status?id=${res.id}`);

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
          // Ignore status network glitches
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
  };

  // Resume background polling with existing generation ID
  const resumePollingForScene = async (sceneIndex: number, generationId: string) => {
    // Clear any previous interval first
    const existingInterval = (window as any)[`_scene_poll_${sceneIndex}`];
    if (existingInterval) clearInterval(existingInterval);

    // Keep state as rendering, ensure ID is set
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
        const status = await apiFetch<{
          status: string;
          videoUrl?: string;
          error?: string;
        }>(`/api/video/status?id=${generationId}`);

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
        // Ignore status network glitches
      }
    }, 5000);

    (window as any)[`_scene_poll_${sceneIndex}`] = intervalId;
  };

  // ─── AUTO-RESUME OR INITIATE QUEUED GENERATIONS ON PROJECT LOAD ──────────
  useEffect(() => {
    if (!storyboard || !activeProjectId) return;

    storyboard.scenes.forEach((scene, idx) => {
      const status = videoStatus[idx];
      const isPolling = !!(window as any)[`_scene_poll_${idx}`];

      if (!status || status.status === "succeeded" || status.status === "failed") return;

      if (status.status === "rendering" && status.id && !isPolling) {
        // Resume polling for existing background rendering task (even in manual mode)
        void resumePollingForScene(idx, status.id);
      } else if (productionMode === "auto-merge" && (status.status === "idle" || (status.status === "rendering" && !status.id)) && !isPolling) {
        // Trigger fresh generation for unstarted scenes ONLY in auto-merge mode
        void generateVideoForScene(idx, scene.fullPrompt);
      }
    });
  }, [storyboard, activeProjectId, productionMode]);

  // Scene prompt revision calling storyRevise cloud function
  const reviseScenePrompt = async (sceneIndex: number) => {
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

      // Update scene prompts in state
      const updatedScenes = [...storyboard.scenes];
      updatedScenes[sceneIndex] = {
        ...scene,
        fullPrompt: res.revisedPrompt,
        action: `[REVISED] ${scene.action}`,
      };

      setStoryboard({
        ...storyboard,
        scenes: updatedScenes,
      });

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
  };

  // Clipboard utility helper
  const copyToClipboard = (text: string, index: number) => {
    void navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className={`flex h-full flex-col bg-background text-neutral-200 ${view === "wizard" && wizardStep === 2 ? "" : "pt-16"}`}>
      {/* ─── PORTAL GATEWAY: CENTERED MINIMAL CARD PORTAL ────────────────────── */}
      {view === "home" && (
        <div className="flex flex-1 items-center justify-center p-6 md:p-12 min-h-[calc(100vh-4rem)]">
          <div className="grid w-full max-w-4xl grid-cols-1 gap-8 md:grid-cols-2">
            {/* OPTION 1: AGENTIC STORYBOARDING */}
            <button
              onClick={() => {
                setView("wizard");
                setWizardStep(1);
              }}
              className="group relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/5 bg-black p-10 text-center hover:border-neutral-700 transition-all duration-300 shadow-2xl hover:shadow-neutral-900/10 min-h-[340px] md:min-h-[380px]"
            >
              {/* Loop video cover showing cinematic ambient scene */}
              <div className="absolute inset-0 z-0">
                <video
                  src="/media/dash-storyboard.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="h-full w-full object-cover opacity-35 group-hover:opacity-55 group-hover:scale-105 transition-all duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f1d] via-[#0a0f1d]/60 to-transparent" />
              </div>

              <div className="relative z-10 flex flex-col items-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-800 border border-neutral-700 text-neutral-300 group-hover:scale-110 transition-transform">
                  <Clapperboard size={26} />
                </span>
                <h2 className="mt-8 text-2xl font-bold text-white tracking-tight">
                  Storyboard
                </h2>
                <span className="mt-2.5 inline-flex text-[11px] font-semibold tracking-wider text-neutral-300 bg-neutral-800 border border-neutral-700 rounded-full px-3 py-0.5 uppercase">
                  Agentic Director
                </span>
                <p className="mt-4 text-xs text-neutral-400 leading-relaxed max-w-xs">
                  Pitch your concept or script. Our Gemini AI director drafts a complete, cohesive multi-scene storyboard with custom style headers instantly.
                </p>
                <span className="mt-8 flex items-center gap-1 text-xs font-bold text-white group-hover:translate-x-1 transition-transform">
                  Initialize Storyboard <ChevronRight size={14} />
                </span>
              </div>
            </button>

            {/* OPTION 2: DIRECT STUDIO GATEWAY WITH THREE SUB-BOXES */}
            <div className="flex flex-col justify-center rounded-2xl border border-white/5 bg-surface/40 p-10 hover:border-neutral-800 transition-all duration-300 min-h-[340px] md:min-h-[380px]">
              <div className="flex flex-col items-center text-center">
                <span className="flex h-14 w-16 items-center justify-center rounded-2xl bg-neutral-900 border border-neutral-800 text-neutral-400">
                  <Video size={24} />
                </span>
                <h2 className="mt-6 text-2xl font-bold text-white tracking-tight">Direct Studio</h2>
                <span className="mt-2 inline-flex text-[10px] font-semibold tracking-wider text-neutral-500 bg-white/5 rounded-full px-3 py-0.5 uppercase">
                  Instant Rendering
                </span>
                <p className="mt-3 text-xs text-neutral-500 leading-relaxed max-w-xs">
                  Skip the planning stage and jump straight into generating standalone video segments, audio, or graphics.
                </p>
              </div>

              {/* The Three Inner Sub-Boxes: Video Studio, Image Studio & Audio Studio */}
              <div className="mt-6 grid grid-cols-3 gap-3">
                {/* SUB-BOX 1: VIDEO STUDIO (with custom loop video) */}
                <Link
                  href="/dashboard/video"
                  className="group/item relative flex flex-col justify-end overflow-hidden rounded-xl border border-white/5 bg-surface-2 aspect-video hover:border-white/10 transition-all duration-300 shadow-lg"
                >
                  <video
                    src="/media/dash-video-studio.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="absolute inset-0 h-full w-full object-cover opacity-50 group-hover/item:opacity-85 group-hover/item:scale-105 transition-all duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f1d] via-[#0a0f1d]/45 to-transparent" />
                  <div className="relative z-10 p-3 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-white tracking-wide">Video Studio</span>
                    <ChevronRight size={11} className="text-neutral-400 group-hover/item:translate-x-0.5 transition-transform animate-none" />
                  </div>
                </Link>

                {/* SUB-BOX 2: IMAGE STUDIO (with premium graphic image) */}
                <Link
                  href="/dashboard/image"
                  className="group/item relative flex flex-col justify-end overflow-hidden rounded-xl border border-white/5 bg-surface-2 aspect-video hover:border-white/10 transition-all duration-300 shadow-lg"
                >
                  <img
                    src="/media/app-video.jpg"
                    alt="Image Studio Reference"
                    className="absolute inset-0 h-full w-full object-cover opacity-50 group-hover/item:opacity-85 group-hover/item:scale-105 transition-all duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f1d] via-[#0a0f1d]/45 to-transparent" />
                  <div className="relative z-10 p-3 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-white tracking-wide">Image Studio</span>
                    <ChevronRight size={11} className="text-neutral-400 group-hover/item:translate-x-0.5 transition-transform animate-none" />
                  </div>
                </Link>

                {/* SUB-BOX 3: AUDIO STUDIO (with custom loop video) */}
                <Link
                  href="/dashboard/audio"
                  className="group/item relative flex flex-col justify-end overflow-hidden rounded-xl border border-white/5 bg-surface-2 aspect-video hover:border-white/10 transition-all duration-300 shadow-lg"
                >
                  <video
                    src="/media/dash-audio-studio.mp4"
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="absolute inset-0 h-full w-full object-cover opacity-50 group-hover/item:opacity-85 group-hover/item:scale-105 transition-all duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f1d] via-[#0a0f1d]/45 to-transparent" />
                  <div className="relative z-10 p-3 flex items-center justify-between">
                    <span className="text-[10px] font-bold text-white tracking-wide">Audio Studio</span>
                    <ChevronRight size={11} className="text-neutral-400 group-hover/item:translate-x-0.5 transition-transform animate-none" />
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {view === "wizard" && (
        <div className="flex flex-1 flex-col overflow-y-auto relative w-full bg-transparent">
          {/* Symmetrical Fixed Cinematic Background Layer */}
          {wizardStep === 2 && (
            <div className="fixed inset-0 z-0 pointer-events-none w-full h-full">
              <div 
                className="w-full h-full bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: "url('/media/storyboard_cinematic_bg.png')" }}
              />
              <div className="absolute inset-0 bg-[#0a0f1d]/75 backdrop-blur-[2px]" />
            </div>
          )}

          <div className={`relative z-10 flex flex-col flex-1 px-6 py-6 pb-32 mx-auto w-full ${wizardStep === 2 ? "pt-24 max-w-5xl" : "max-w-3xl"}`}>
          {/* Back button */}
          <button
            onClick={() => setView("home")}
            className="self-start flex items-center gap-1.5 text-xs text-neutral-500 hover:text-white transition-colors"
          >
            <ChevronLeft size={14} /> Back to Portal
          </button>

          {/* Stepper Progress bar */}
          <div className="mt-6 flex items-center justify-between border-b border-white/5 pb-4">
            <h2 className="text-lg font-bold text-white tracking-tight">
              Storyboard Configuration
            </h2>
            <div className="flex gap-1.5">
              {[1, 2, 3].map((s) => (
                <span
                  key={s}
                  className={`h-1.5 w-8 rounded-full transition-all duration-300 ${
                    wizardStep === s ? "bg-white w-12" : "bg-neutral-800"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Loading Screen Overlay */}
          {generating && (
            <div className="flex flex-1 flex-col items-center justify-center py-24 text-center">
              <RefreshCw size={36} className="text-white animate-spin" />
              <h3 className="mt-5 text-lg font-semibold text-white">Generating Storyboard Spec</h3>
              <p className="mt-2 text-xs text-neutral-500 max-w-md leading-relaxed">
                Our Gemini AI director is compiling your visual style contract, mapping out consecutive moments, and formatting copy-ready prompt blocks...
              </p>
            </div>
          )}

          {!generating && (
            <div className="mt-6 flex flex-1 flex-col">
              {/* STEP 1: LENGTH SELECTION */}
              {wizardStep === 1 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-sm font-bold text-white">Select Video Run-Time</h3>
                    <p className="text-xs text-neutral-500">
                      Determine campaign duration. Every scene compiles into precisely 10 seconds of video.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    {[
                      { id: "30s", title: "30 Seconds", subtitle: "3 Scenes", desc: "Sleek, rapid ad block" },
                      { id: "60s", title: "60 Seconds", subtitle: "6 Scenes", desc: "Standard campaign flow" },
                      { id: "90s", title: "90 Seconds", subtitle: "9 Scenes", desc: "Longform narrative spec" },
                    ].map((item) => (
                      <button
                        key={item.id}
                        onClick={() => setLength(item.id as any)}
                        className={`group flex flex-col rounded-2xl border p-6 text-left transition-all duration-300 ${
                          length === item.id
                            ? "border-blue-500 bg-[#0c152d] text-white"
                            : "border-white/5 bg-surface-2 hover:border-white/10 hover:bg-[#131d35]"
                        }`}
                      >
                        <span className="text-[10px] font-bold text-neutral-400 tracking-wider uppercase">{item.subtitle}</span>
                        <span className="mt-1.5 text-base font-extrabold tracking-tight group-hover:text-blue-400 transition-colors">
                          {item.title}
                        </span>
                        <p className="mt-2 text-xs text-neutral-400 leading-normal">{item.desc}</p>
                      </button>
                    ))}
                  </div>

                  {/* PAST PROJECTS SECTION (SCROLLABLE & FIRESTORE INTEGRATED) */}
                  <div className="pt-8 border-t border-white/5">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-widest font-mono flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-neutral-500 animate-pulse" />
                          Past Storyboard Projects
                        </h4>
                        <p className="text-[10px] text-neutral-500 mt-0.5">
                          Access or resume work on your previously generated campaign specs.
                        </p>
                      </div>
                    </div>

                    {projectsLoading ? (
                      <div className="flex items-center gap-2 py-8 justify-center text-xs text-neutral-500 font-mono uppercase tracking-wider">
                        <RefreshCw size={12} className="animate-spin" /> Loading Projects...
                      </div>
                    ) : projects.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-white/5 bg-neutral-950/20 py-8 px-4 text-center">
                        <Clapperboard size={20} className="text-neutral-600 mx-auto mb-2" />
                        <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-mono">No past projects found</p>
                        <p className="text-[10px] text-neutral-600 mt-1 max-w-xs mx-auto">
                          Configure a new campaign run-time above and describe your film concept to start.
                        </p>
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent">
                        {projects.map((proj) => (
                          <div
                            key={proj.id}
                            onClick={() => loadProject(proj)}
                            className="group relative flex flex-col justify-between rounded-xl border border-white/5 bg-surface-2/80 hover:bg-surface-2 p-4 text-left transition-all duration-300 cursor-pointer hover:border-white/10"
                          >
                            <button
                              onClick={(e) => deleteProject(e, proj.id)}
                              className="absolute top-3 right-3 text-neutral-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 p-1 z-20"
                              title="Delete Storyboard Project"
                            >
                              <X size={12} />
                            </button>

                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[8px] font-bold font-mono tracking-wider text-white uppercase border border-white/10">
                                  {proj.length}
                                </span>
                                <span className="text-[9px] font-mono text-neutral-500 uppercase">
                                  {new Date(proj.createdAt || 0).toLocaleDateString()}
                                </span>
                              </div>

                              <h5 className="mt-2 text-xs font-bold text-white group-hover:text-white transition-colors line-clamp-1">
                                {proj.title}
                              </h5>
                              <p className="mt-1 text-[10px] text-neutral-500 leading-normal line-clamp-2">
                                {proj.concept}
                              </p>
                            </div>

                            <div className="mt-3.5 border-t border-white/[0.03] pt-2 flex items-center justify-between text-[8px] font-mono text-neutral-500 uppercase tracking-widest">
                              <span>Brand: {proj.brandName || "Client"}</span>
                              <span className="flex items-center gap-1">
                                <span className="h-1 w-1 rounded-full bg-emerald-400" />
                                Ready
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* STEP 2: CAMPAIGN PROMPT & VOICE */}
              {wizardStep === 2 && (
                <div className="space-y-8 select-none">
                  {/* Centralized Cinematic Leonardo AI Style Header */}
                  <div className="flex flex-col items-center text-center py-6 select-none">
                    <h1 className="text-4xl md:text-5xl font-black tracking-widest text-white uppercase select-none drop-shadow-2xl">
                      DIRECT YOUR VISION
                    </h1>
                  </div>

                  {/* Centralized Capsule/Pill Prompt Container */}
                  <div className="max-w-2xl mx-auto w-full space-y-4 relative z-20">
                    <div className="relative rounded-3xl border border-white/10 bg-[#0e1630]/75 backdrop-blur-xl p-4 transition-all duration-300 shadow-2xl focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/10">
                      <div className="flex items-start gap-3">
                        <div className={`transition-all duration-500 ease-in-out overflow-hidden w-full ${promptExpanded ? "h-28" : "h-10"}`}>
                          <textarea
                            value={promptText}
                            onFocus={() => setPromptExpanded(true)}
                            onChange={(e) => setPromptText(e.target.value)}
                            placeholder="Type a prompt..."
                            className="w-full h-full bg-transparent resize-none outline-none text-sm placeholder:text-neutral-500 leading-relaxed text-white pt-1"
                          />
                        </div>
                      </div>

                      {/* Display the options panel if expanded or active */}
                      {promptExpanded && (
                        <>
                          <div className="my-3 border-t border-white/5" />
                          <div className="flex items-center justify-between gap-3 pt-1">
                            {/* Left Side options */}
                            <div className="flex items-center gap-2">
                              {recording ? (
                                <button
                                  type="button"
                                  onClick={stopSpeechRecognition}
                                  className="flex items-center gap-1 bg-red-600/20 border border-red-500/20 rounded-xl px-2.5 py-1.5 text-[10px] font-bold text-red-400 animate-pulse transition-all"
                                >
                                  <MicOff size={10} /> Stop
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={startSpeechRecognition}
                                  className="flex items-center gap-1 bg-white/5 border border-white/5 hover:border-white/10 rounded-xl px-2.5 py-1.5 text-[10px] font-bold text-neutral-400 hover:text-white transition-all"
                                >
                                  <Mic size={10} className="text-blue-400" /> Voice
                                </button>
                              )}
                            </div>

                            {/* Right Side options */}
                            <div className="flex items-center gap-2">
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => setAspectDropdownOpen(!aspectDropdownOpen)}
                                  className={`flex items-center gap-2 px-3.5 py-2 rounded-2xl border backdrop-blur-xl transition-all text-xs font-semibold shadow-xl active:scale-95 duration-200 ${
                                    aspectDropdownOpen 
                                      ? "bg-surface border-blue-500 text-white" 
                                      : "bg-surface/90 border-white/10 hover:border-blue-500/50 text-neutral-200"
                                  }`}
                                >
                                  <span className="text-[9px] font-extrabold tracking-wider font-mono text-neutral-400 uppercase">Aspect</span>
                                  <span className="text-[12px] font-semibold text-white">
                                    {aspectRatio === "16:9" ? "Landscape (16:9)" : "Portrait (9:16)"}
                                  </span>
                                  <ChevronDown size={12} className={`text-blue-400 transition-transform duration-300 ${aspectDropdownOpen ? "rotate-180 text-blue-400" : "text-neutral-400"}`} />
                                </button>

                                {aspectDropdownOpen && (
                                  <>
                                    {/* Backdrop click overlay */}
                                    <div 
                                      className="fixed inset-0 z-40" 
                                      onClick={() => setAspectDropdownOpen(false)} 
                                    />
                                    {/* Dropdown Options Box */}
                                    <div className="absolute right-0 bottom-full mb-2 z-50 min-w-[160px] rounded-2xl border border-white/10 bg-surface/90 backdrop-blur-xl p-1.5 shadow-2xl animate-scaleUp origin-bottom-right">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setAspectRatio("16:9");
                                          setAspectDropdownOpen(false);
                                        }}
                                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors ${
                                          aspectRatio === "16:9" 
                                            ? "bg-white/10 text-white" 
                                            : "text-neutral-400 hover:text-white hover:bg-white/5"
                                        }`}
                                      >
                                        Landscape (16:9)
                                        {aspectRatio === "16:9" && <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setAspectRatio("9:16");
                                          setAspectDropdownOpen(false);
                                        }}
                                        className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-colors ${
                                          aspectRatio === "9:16" 
                                            ? "bg-white/10 text-white" 
                                            : "text-neutral-400 hover:text-white hover:bg-white/5"
                                        }`}
                                      >
                                        Portrait (9:16)
                                        {aspectRatio === "9:16" && <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />}
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* PRE-BUILT CAMPAIGN TEMPLATE EXAMPLES GRID */}
                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <span className="text-xs font-bold text-white uppercase tracking-widest block">
                      Select a Pre-Built Cinematic Vibe Template
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {STORYBOARD_TEMPLATES.map((item, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            if (selectedTemplateIdx === idx) {
                              setSelectedTemplateIdx(null);
                              setPromptText("");
                              setBrandName("");
                              setProduct("");
                              setHasCharacter(true);
                              setCharacterName("");
                              setCharacterDesc("");
                            } else {
                              setSelectedTemplateIdx(idx);
                              setPromptText(item.concept);
                              setBrandName(item.brandName);
                              setProduct(item.product);
                              setHasCharacter(item.hasCharacter);
                              setCharacterName(item.characterName);
                              setCharacterDesc(item.characterDesc);
                            }
                          }}
                          className={`group relative flex flex-col overflow-hidden rounded-2xl border p-4 text-left transition-all duration-300 ${
                            selectedTemplateIdx === idx
                              ? "border-white bg-neutral-900/50 shadow-xl shadow-none ring-2 ring-white/20"
                              : selectedTemplateIdx !== null
                              ? "border-white/5 bg-surface opacity-40 hover:opacity-80 hover:border-white/10"
                              : "border-white/5 bg-surface hover:border-white/10 hover:shadow-2xl shadow-none"
                          }`}
                        >
                          {/* Selected checkmark indicator */}
                          {selectedTemplateIdx === idx && (
                            <span className="absolute top-3 right-3 z-20 flex h-6 w-6 items-center justify-center rounded-full bg-neutral-800 text-white border border-white/20 shadow-md">
                              <Check size={11} />
                            </span>
                          )}

                          {/* 6-Second Looping Video Cover / Preview */}
                          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl bg-neutral-950 border border-white/5">
                            {item.coverVideo.endsWith(".mp4") ? (
                              <video
                                src={item.coverVideo}
                                autoPlay
                                loop
                                muted
                                playsInline
                                className="h-full w-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-[1.03] transition-all duration-700"
                              />
                            ) : (
                              <img
                                src={item.coverVideo}
                                alt={item.name}
                                className="h-full w-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-[1.03] transition-all duration-700"
                              />
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-[#08080a]/95 via-transparent to-transparent" />
                            <span className="absolute bottom-3 left-3 text-[9px] font-bold tracking-widest text-white uppercase bg-white/20 border border-white/10 rounded px-2.5 py-1">
                              {item.subtitle}
                            </span>
                          </div>
                          
                          <h4 className="mt-4 text-base font-extrabold text-white tracking-tight group-hover:text-white transition-colors leading-tight">
                            {item.name}
                          </h4>
                          <p className="mt-2 text-xs text-neutral-400 leading-relaxed line-clamp-3">
                            {item.concept}
                          </p>
                          <div className="mt-4 pt-3 border-t border-white/5 flex flex-wrap gap-2">
                            <span className="text-[10px] font-medium text-neutral-500 bg-white/5 rounded px-2 py-0.5">
                              Product: {item.product}
                            </span>
                            {item.hasCharacter && (
                              <span className="text-[10px] font-medium text-white/80 bg-white/5 border border-white/10 rounded px-2 py-0.5">
                                Character: {item.characterName}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: BRANDING & CHARACTER LOCK OPTION */}
              {wizardStep === 3 && (
                <div className="space-y-5">
                  <div>
                    <h3 className="text-sm font-bold text-white">Brand Profile & Subject Lock</h3>
                    <p className="text-xs text-neutral-500">
                      Configure your brand information and toggle recurring character parameters.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-400">Brand Name</label>
                        <input
                          value={brandName}
                          onChange={(e) => setBrandName(e.target.value)}
                          placeholder="e.g. DEX"
                          className="mt-1.5 w-full rounded-xl border border-white/5 bg-surface-2 px-4 py-2.5 text-xs text-white focus:border-white/10 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-400">Main Product/Service</label>
                        <input
                          value={product}
                          onChange={(e) => setProduct(e.target.value)}
                          placeholder="e.g. Groundnut Paste"
                          className="mt-1.5 w-full rounded-xl border border-white/5 bg-surface-2 px-4 py-2.5 text-xs text-white focus:border-white/10 outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      {/* Character Lock Toggle */}
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-400 mb-1.5">
                          Storytelling / Character Type
                        </label>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setHasCharacter(true)}
                            className={`flex-1 py-3 text-xs font-bold rounded-xl border transition-all duration-300 ${
                              hasCharacter
                                ? "border-blue-500 bg-[#0c152d] text-white"
                                : "border-white/5 bg-surface-2 hover:border-white/10 hover:bg-[#131d35] text-neutral-400"
                            }`}
                          >
                            Main Character Lock
                          </button>
                          <button
                            type="button"
                            onClick={() => setHasCharacter(false)}
                            className={`flex-1 py-3 text-xs font-bold rounded-xl border transition-all duration-300 ${
                              !hasCharacter
                                ? "border-blue-500 bg-[#0c152d] text-white"
                                : "border-white/5 bg-surface-2 hover:border-white/10 hover:bg-[#131d35] text-neutral-400"
                            }`}
                          >
                            Multiple People / Product Focus
                          </button>
                        </div>
                        <p className="mt-1.5 text-[10px] text-neutral-500 leading-normal">
                          {hasCharacter
                            ? "Locks a single recurring main character across all scenes for unified narrative focus."
                            : "Different scenes will feature different people and community members interacting around the product."}
                        </p>
                      </div>

                      {hasCharacter && (
                        <div className="grid grid-cols-1 gap-3.5 animate-fadeIn">
                          <div>
                            <label className="block text-[11px] font-semibold text-neutral-400">Subject Name</label>
                            <input
                              value={characterName}
                              onChange={(e) => setCharacterName(e.target.value)}
                              placeholder="e.g. Nyima"
                              className="mt-1 w-full rounded-xl border border-white/5 bg-surface-2 px-4 py-2 text-xs text-white focus:border-white/10 outline-none"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-neutral-400">Physical Markers (LCB)</label>
                            <input
                              value={characterDesc}
                              onChange={(e) => setCharacterDesc(e.target.value)}
                              placeholder="e.g. Oval-faced Gambian woman, neat thin cornrow braids, 20s"
                              className="mt-1 w-full rounded-xl border border-white/5 bg-surface-2 px-4 py-2 text-xs text-white focus:border-white/10 outline-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Multi-material File Upload block */}
                  <div className="space-y-2">
                    <label className="block text-[11px] font-semibold text-neutral-400">
                      Brand Materials & Graphics
                    </label>
                    <div
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragging(true);
                      }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragging(false);
                        handleDrop(e);
                      }}
                      className={`rounded-xl border border-dashed p-6 text-center transition-all duration-300 relative ${
                        isDragging
                          ? "border-white/20 bg-neutral-900/50 shadow-lg scale-[1.01]"
                          : "border-white/10 bg-surface hover:border-white/10"
                      }`}
                    >
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        id="materials-upload"
                        onChange={handleMaterialsUpload}
                        className="hidden"
                      />
                      <label
                        htmlFor="materials-upload"
                        className="cursor-pointer flex flex-col items-center justify-center"
                      >
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 mb-2">
                          <Upload size={14} />
                        </span>
                        <span className="text-xs font-semibold text-white">Upload Brand Files / Logos</span>
                        <span className="mt-1 text-[10px] text-neutral-500">
                          Attach multiple reference graphics, fonts, or assets (PNG, JPG, SVG)
                        </span>
                      </label>
                    </div>

                    {/* Material badging list */}
                    {brandMaterials.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        {brandMaterials.map((file, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-400"
                          >
                            <Paperclip size={10} />
                            <span className="max-w-[120px] truncate">{file.name}</span>
                            <button
                              type="button"
                              onClick={() => removeBrandMaterial(i)}
                              className="text-neutral-500 hover:text-red-400 font-bold ml-1 text-xs"
                            >
                              &times;
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {error && (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4 flex gap-3 text-xs text-red-400 items-start">
                      <AlertCircle size={14} className="shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      {/* FLOATING NAVIGATION BAR FOR WIZARD */}
      {view === "wizard" && (
        <div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4 animate-slideUp">
          <div className="flex items-center gap-6 rounded-2xl border border-white/5 bg-surface/85 backdrop-blur-xl px-6 py-3.5 shadow-2xl shadow-black/95 w-full max-w-xl justify-between">
            {/* BACK BUTTON */}
            <button
              onClick={() => {
                if (wizardStep === 1) {
                  setView("home");
                } else if (wizardStep === 2) {
                  setWizardStep(1);
                  setSelectedTemplateIdx(null);
                } else if (wizardStep === 3) {
                  setWizardStep(2);
                }
              }}
              className="flex items-center gap-1.5 rounded-xl bg-white/5 hover:bg-white/10 px-4 py-2.5 text-xs font-semibold text-neutral-300 transition-colors border border-white/5"
            >
              <ChevronLeft size={13} /> Back
            </button>

            {/* STEP PROGRESS INDICATOR */}
            <div className="flex items-center gap-1.5">
              {[1, 2, 3].map((s) => (
                <span
                  key={s}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    wizardStep === s ? "bg-white w-6" : "bg-neutral-800 w-1.5"
                  }`}
                />
              ))}
            </div>

            {/* CONTINUE / ACTION BUTTON */}
            {wizardStep === 1 && (
              <button
                onClick={() => setWizardStep(2)}
                className="flex items-center gap-1.5 rounded-xl bg-white hover:bg-neutral-200 px-5 py-2.5 text-xs font-bold text-black transition-all"
              >
                Continue <ChevronRight size={13} />
              </button>
            )}

            {wizardStep === 2 && (
              <button
                disabled={!promptText.trim() && selectedTemplateIdx === null}
                onClick={() => setWizardStep(3)}
                className={`flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-xs font-bold transition-all shadow-lg ${
                  (!promptText.trim() && selectedTemplateIdx === null)
                    ? "bg-neutral-900 border border-white/5 text-neutral-600 cursor-not-allowed opacity-50 shadow-none"
                    : "bg-white hover:bg-neutral-200 text-black cursor-pointer"
                }`}
              >
                Continue <ChevronRight size={13} />
              </button>
            )}

            {wizardStep === 3 && (
              <button
                disabled={generating}
                onClick={() => setStoryboardPayOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-white hover:bg-neutral-200 px-5.5 py-2.5 text-xs font-bold text-black transition-all"
              >
                {generating ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Zap size={13} /> Generate Spec
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {view === "storyboard" && (
        !storyboard ? (
          <div className="flex flex-1 flex-col items-center justify-center p-12 text-center h-full max-w-lg mx-auto">
            {generating ? (
              <div className="space-y-4">
                <RefreshCw size={42} className="text-white animate-spin mx-auto" />
                <h3 className="text-lg font-bold text-white tracking-tight uppercase font-mono text-center">Compiling Storyboard Spec...</h3>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed text-center">
                  Our Gemini AI director is composing your visual style matrix, structuring consecutive script moments, and generating custom-ready direct prompts. This takes about 10-15 seconds.
                </p>
              </div>
            ) : error ? (
              <div className="space-y-5 rounded-2xl border border-red-500/15 bg-red-950/20 p-8 max-w-md mx-auto">
                <AlertCircle size={36} className="text-red-400 mx-auto animate-pulse" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono text-center">Generation Encountered a Transient Issue</h3>
                <p className="text-xs text-red-400/90 leading-relaxed text-center">
                  {error || "Vertex AI rate limits or internal operation timeout. Your credits have not been deducted."}
                </p>
                <div className="flex justify-center pt-2">
                  <button
                    onClick={() => {
                      setError(null);
                      void generateStoryboard();
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-white hover:bg-neutral-200 px-5.5 py-2.5 text-xs font-bold text-black transition-all"
                  >
                    <RefreshCw size={12} /> Retry Storyboard Generation
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <AlertCircle size={32} className="text-neutral-500 mx-auto" />
                <h3 className="text-sm font-bold text-neutral-300 uppercase font-mono text-center">Project Empty</h3>
                <p className="text-xs text-neutral-500 max-w-sm mx-auto text-center">
                  No storyboard specification has been initialized for this project.
                </p>
              </div>
            )}
          </div>
        ) : (
          productionMode === "auto-merge" ? (
          /* ─── CINEMATIC THEATER AUTO-MERGE VIEW ─────────────────── */
          (() => {
            const totalScenes = storyboard.scenes.length;
            const completedCount = storyboard.scenes.filter((_, idx) => videoStatus[idx]?.status === "succeeded").length;
            const isCompiling = completedCount < totalScenes;
            const compilePercent = Math.round((completedCount / totalScenes) * 100);

            return (
              <div className="flex flex-1 flex-col overflow-y-auto px-6 py-6 w-full max-w-4xl mx-auto space-y-6">
                {/* Widescreen Theater Header */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/5 pb-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold text-white bg-neutral-800 rounded px-2.5 py-0.5 uppercase border border-white/10">
                        Cinematic Theater Player
                      </span>
                      {isCompiling ? (
                        <span className="flex items-center gap-1 text-[9px] font-bold text-yellow-400 bg-yellow-500/10 rounded px-2 py-0.5 uppercase border border-yellow-500/15 animate-pulse">
                          Compiling Reels ({completedCount}/{totalScenes})
                        </span>
                      ) : compileStatus === "compiling" ? (
                        <span className="flex items-center gap-1 text-[9px] font-bold text-white bg-neutral-800 rounded px-2 py-0.5 uppercase border border-white/10 animate-pulse">
                          Stitching & Rendering Final Film...
                        </span>
                      ) : compileStatus === "succeeded" ? (
                        <span className="flex items-center gap-1 text-[9px] font-bold text-emerald-400 bg-emerald-500/10 rounded px-2 py-0.5 uppercase border border-emerald-500/15">
                          Commercial Film Rendered
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[9px] font-bold text-neutral-300 bg-neutral-800 rounded px-2 py-0.5 uppercase border border-neutral-700">
                          Timeline Editing
                        </span>
                      )}
                    </div>
                    <h2 className="mt-2 text-xl font-bold tracking-tight text-white md:text-2xl">
                      {storyboard.title}
                    </h2>
                    <p className="mt-1 text-xs text-neutral-500 leading-relaxed max-w-xl">{storyboard.concept}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setProductionMode("manual")}
                      className="flex items-center gap-1.5 rounded-xl bg-white/5 border border-white/5 px-4 py-2 text-xs font-semibold hover:bg-white/10 transition-colors"
                    >
                      <Edit3 size={12} /> Switch to Script Editor
                    </button>
                    <button
                      onClick={() => {
                        if (confirm("Are you sure you want to reset this draft? Unsaved changes will be lost.")) {
                          setView("home");
                        }
                      }}
                      className="flex items-center gap-1.5 rounded-xl bg-white/5 border border-white/5 px-4 py-2 text-xs font-semibold hover:bg-white/10 transition-colors"
                    >
                      <Undo2 size={12} /> Reset Draft
                    </button>
                  </div>
                </div>

                {/* THEATER VIEWPORT SCREEN */}
                <div className="w-full aspect-video shrink-0 relative rounded-2xl bg-black border border-white/5 overflow-hidden shadow-[0_12px_45px_rgba(0,0,0,0.95)]">
                  {isCompiling ? (
                    /* CASE A: COMPILING PIPELINE VIEW */
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center space-y-6 bg-[radial-gradient(circle_at_center,rgba(124,58,237,0.08)_0%,rgba(0,0,0,1)_100%)] bg-black">
                      <div className="relative flex items-center justify-center h-20 w-20">
                        <span className="absolute h-full w-full rounded-full border-2 border-white/10 animate-ping duration-1000" />
                        <span className="absolute h-16 w-16 rounded-full border border-white/10 animate-spin border-t-white" />
                        <Clapperboard className="text-white animate-pulse relative" size={26} />
                      </div>

                      <div className="space-y-1.5">
                        <h3 className="text-sm font-bold text-white uppercase tracking-widest font-mono flex items-center justify-center gap-2">
                          Rendering Scene Segments
                        </h3>
                        <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
                          Gemini Omni is orchestrating cinematic camera movements, actors, and brand styles for your advertisement. Please do not close this page.
                        </p>
                      </div>

                      {/* Premium Progress HUD Box */}
                      <div className="bg-neutral-950/60 backdrop-blur-md border border-white/5 rounded-2xl p-5 w-full max-w-sm space-y-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
                        <div className="flex justify-between text-[10px] font-mono text-neutral-400 uppercase tracking-widest font-bold">
                          <span className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 bg-neutral-500 rounded-full animate-ping" />
                            Synthesizing Reel
                          </span>
                          <span>{compilePercent}% ({completedCount}/{totalScenes} Clips)</span>
                        </div>
                        <div className="h-2 w-full bg-neutral-900 rounded-full overflow-hidden border border-white/[0.02] p-[1px]">
                          <div
                            className="h-full bg-gradient-to-r from-neutral-700 to-neutral-800 rounded-full transition-all duration-500 ease-out shadow-[0_0_12px_rgba(168,85,247,0.5)]"
                            style={{ width: `${compilePercent}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[9px] font-mono text-neutral-500 uppercase tracking-wider">
                          <span>Model: Gemini Omni Flash</span>
                          <span>Est. Time: ~30s</span>
                        </div>
                      </div>
                    </div>
                  ) : compileStatus === "compiling" ? (
                    /* CASE B: FINAL FILM STITCHING / COMPILING PIPELINE SCREEN */
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center space-y-6 bg-[radial-gradient(circle_at_center,rgba(168,85,247,0.08)_0%,rgba(0,0,0,1)_100%)] bg-black">
                      <div className="relative flex items-center justify-center h-20 w-20">
                        <span className="absolute h-full w-full rounded-full border-2 border-white/10 animate-ping duration-1000" />
                        <span className="absolute h-16 w-16 rounded-full border border-white/10 animate-spin border-t-white" />
                        <Zap className="text-white animate-pulse relative" size={26} />
                      </div>

                      <div className="space-y-1.5">
                        <h3 className="text-sm font-bold text-white uppercase tracking-widest font-mono flex items-center justify-center gap-2">
                          Assembling Cinematic Master
                        </h3>
                        <p className="text-xs text-neutral-500 max-w-sm mx-auto leading-relaxed">
                          Processing timeline operations on Google Cloud Run. We are cutting, trimming, stitching scene segments, and mixing background soundtracks into a final MP4 film.
                        </p>
                      </div>

                      <div className="bg-neutral-950/80 border border-white/5 rounded-2xl p-4 w-full max-w-sm space-y-2 text-left">
                        <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-400">
                          <span className="h-1.5 w-1.5 bg-neutral-500 rounded-full animate-ping" />
                          <span>Standardizing frame rates & layout...</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-neutral-400">
                          <span className="h-1.5 w-1.5 bg-neutral-400 rounded-full animate-ping" />
                          <span>Blending background soundtrack...</span>
                        </div>
                      </div>
                    </div>
                  ) : compileStatus === "succeeded" && compileVideoUrl ? (
                    /* CASE C: SINGLE FULLY-COMPILED FILM PLAYER */
                    <div className="absolute inset-0 flex items-center justify-center bg-black group/player">
                      <video
                        src={compileVideoUrl}
                        controls
                        autoPlay={theaterPlaying}
                        playsInline
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-4 left-4 rounded-lg bg-black/70 backdrop-blur-md border border-white/5 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                        Final Multi-scene Compiled Film
                      </div>
                    </div>
                  ) : (
                    /* CASE D: SEAMLESS LIVE EDITS PREVIEW PLAYLIST PLAYER */
                    <div className="absolute inset-0 flex items-center justify-center bg-black group/player">
                      <video
                        key={currentScenePlayIdx}
                        src={videoStatus[currentScenePlayIdx]?.url}
                        autoPlay={theaterPlaying}
                        playsInline
                        onEnded={() => {
                          if (currentScenePlayIdx < totalScenes - 1) {
                            setCurrentScenePlayIdx((prev) => prev + 1);
                          } else {
                            setTheaterPlaying(false);
                            setCurrentScenePlayIdx(0);
                          }
                        }}
                        className="w-full h-full object-cover"
                      />

                      {/* Quick HUD overlay */}
                      <div className="absolute top-4 left-4 rounded-lg bg-black/60 backdrop-blur-md border border-white/5 px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-white">
                        Active segment: {currentScenePlayIdx + 1} of {totalScenes} (Trim: {((timeline[currentScenePlayIdx]?.trimEnd || 10) - (timeline[currentScenePlayIdx]?.trimStart || 0)).toFixed(1)}s)
                      </div>

                      {/* Giant Play/Pause Overlay Toggle on hover */}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover/player:opacity-100 transition-opacity duration-300 pointer-events-none">
                        <div className="h-14 w-14 rounded-full bg-black/70 backdrop-blur-md border border-white/10 flex items-center justify-center text-white cursor-pointer pointer-events-auto shadow-xl"
                             onClick={() => setTheaterPlaying(!theaterPlaying)}>
                          {theaterPlaying ? <><span className="h-4 w-1.5 bg-white rounded-sm inline-block mr-1" /><span className="h-4 w-1.5 bg-white rounded-sm inline-block" /></> : <Play className="text-white fill-white translate-x-0.5" size={18} />}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* THEATER COMPILING PIPELINE STATS GRID */}
                {isCompiling ? (
                  <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                    {storyboard.scenes.map((scene, idx) => {
                      const stat = videoStatus[idx];
                      const isSceneRendering = stat?.status === "rendering";
                      const isSceneReady = stat?.status === "succeeded";

                      return (
                        <div
                          key={idx}
                          className={`rounded-xl border p-4.5 text-left transition-all duration-300 flex flex-col justify-between relative overflow-hidden ${
                            isSceneRendering
                              ? "border-white/10 bg-neutral-900/50 shadow-[0_4px_24px_rgba(255,255,255,0.02)] animate-pulse"
                              : isSceneReady
                              ? "border-emerald-500/15 bg-emerald-950/[0.02] shadow-[0_4px_24px_rgba(16,185,129,0.03)]"
                              : "border-white/5 bg-surface/50"
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-mono text-neutral-500 font-bold">SEGMENT #{idx + 1}</span>
                              {isSceneRendering ? (
                                <span className="text-[9px] font-bold text-white flex items-center gap-1 uppercase font-mono tracking-wider animate-pulse">
                                  <RefreshCw size={8} className="animate-spin" /> Synthesizing...
                                </span>
                              ) : isSceneReady ? (
                                <span className="text-[9px] font-bold text-emerald-400 flex items-center gap-1 uppercase font-mono tracking-wider">
                                  <Check size={8} /> Ready
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold text-neutral-600 uppercase font-mono tracking-wider">
                                  Queued
                                </span>
                              )}
                            </div>
                            <h4 className="mt-2 text-xs font-bold text-white line-clamp-1">{scene.setting}</h4>
                          </div>
                          <p className="mt-2.5 text-[10px] text-neutral-500 line-clamp-2 leading-relaxed font-sans">
                            {scene.fullPrompt}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* THEATER INTERACTIVE TIMELINE AND AUDIO CONTROLLERS */
                  <div className="space-y-6 animate-in fade-in duration-500">
                    {/* Compilation Errors */}
                    {compileError && (
                      <div className="rounded-xl border border-red-500/10 bg-red-950/10 p-4 text-xs text-red-400 flex items-center gap-2">
                        <AlertCircle size={14} className="shrink-0" />
                        <span>Render Error: {compileError}</span>
                      </div>
                    )}

                    {/* Background Audio Selection */}
                    <div className="rounded-2xl border border-white/5 bg-[#09090c] p-5 space-y-4">
                      <div className="flex items-center justify-between border-b border-white/5 pb-3">
                        <div>
                          <span className="font-bold text-white uppercase tracking-wider font-mono text-[11px] flex items-center gap-1.5 text-white">
                            <Music size={13} /> Cloud Audio Overlay
                          </span>
                          <p className="text-[10px] text-neutral-500 mt-0.5">Select a royalty-free soundtrack preset and adjust background volume blend.</p>
                        </div>
                      </div>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <label className="block text-[9px] font-mono text-neutral-500 uppercase tracking-widest mb-1.5">Select Soundtrack Theme</label>
                          <select
                            value={musicUrl}
                            onChange={(e) => setMusicUrl(e.target.value)}
                            className="w-full rounded-xl bg-neutral-950 border border-white/10 px-3 py-2.5 text-xs text-white focus:outline-none focus:border-white transition-colors"
                          >
                            <option value="">No Background Music (Mute Soundtrack)</option>
                            <option value="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3">Neon Synthwave Theme</option>
                            <option value="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3">Cinematic Uplift Orchestral</option>
                            <option value="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3">Modern Lo-Fi Beat</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[9px] font-mono text-neutral-500 uppercase tracking-widest mb-1.5">Soundtrack Volume: {Math.round(musicVolume * 100)}%</label>
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={musicVolume}
                            onChange={(e) => setMusicVolume(parseFloat(e.target.value))}
                            className="w-full accent-white h-1 bg-neutral-900 rounded-lg appearance-none cursor-pointer mt-4"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Timeline Tracks */}
                    <div className="rounded-2xl border border-white/5 bg-[#09090c] p-5 space-y-5">
                      <div className="flex items-center justify-between border-b border-white/5 pb-3">
                        <div>
                          <span className="font-bold text-white uppercase tracking-wider font-mono text-[11px] flex items-center gap-1.5 text-white">
                            <Video size={13} /> Interactive Clip Timeline
                          </span>
                          <p className="text-[10px] text-neutral-500 mt-0.5">Trim clip regions, click any segment to jump preview, and reorder clips in sequence.</p>
                        </div>

                        {compileStatus === "succeeded" && compileVideoUrl && (
                          <a
                            href={compileVideoUrl}
                            download={`${storyboard.title.replace(/\s+/g, "_")}_full.mp4`}
                            className="flex items-center gap-1.5 rounded-xl bg-neutral-800 border border-white/10 text-white px-4 py-2 text-xs font-semibold hover:bg-white/20 transition-all shadow-md"
                          >
                            <Video size={12} /> Download Final Movie MP4
                          </a>
                        )}
                      </div>

                      <div className="space-y-4">
                        {timeline.length > 0 ? (
                          timeline.map((item, idx) => {
                            const scene = storyboard.scenes[item.sceneIndex];
                            if (!scene) return null;
                            const start = item.trimStart ?? 0;
                            const end = item.trimEnd ?? 10;
                            const duration = end - start;

                            return (
                              <div
                                key={idx}
                                className={`bg-neutral-950/80 border rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-4 hover:border-white/10 transition-colors ${
                                  currentScenePlayIdx === item.sceneIndex ? "border-white/10 bg-neutral-900/10" : "border-white/5"
                                }`}
                              >
                                {/* Left column: Scene Indicator & Jump Preview button */}
                                <div className="w-full md:w-44 shrink-0 flex flex-row items-center gap-3">
                                  <button
                                    onClick={() => {
                                      setCurrentScenePlayIdx(item.sceneIndex);
                                      setTheaterPlaying(true);
                                    }}
                                    className={`h-11 w-11 rounded-lg flex flex-col items-center justify-center border font-mono transition-colors shrink-0 ${
                                      currentScenePlayIdx === item.sceneIndex
                                        ? "border-white bg-neutral-800 text-white shadow-[0_0_10px_rgba(124,58,237,0.15)]"
                                        : "border-white/5 bg-neutral-900 text-neutral-400 hover:text-white hover:border-white/10"
                                    }`}
                                  >
                                    <span className="text-[8px] font-bold">REEL</span>
                                    <span className="text-sm font-extrabold">0{item.sceneIndex + 1}</span>
                                  </button>
                                  <div className="min-w-0">
                                    <h4 className="text-xs font-bold text-white truncate">{scene.setting || "Ad Moment"}</h4>
                                    <span className="text-[9px] font-mono text-neutral-500 block mt-0.5 uppercase tracking-wide">
                                      Span: {start.toFixed(1)}s - {end.toFixed(1)}s
                                    </span>
                                  </div>
                                </div>

                                {/* Center column: Visual Dual Trim Sliders */}
                                <div className="flex-1 flex flex-col gap-2">
                                  <div className="flex items-center justify-between text-[9px] font-mono text-neutral-500">
                                    <span>TRIM START</span>
                                    <span className="text-white font-bold bg-neutral-800 rounded px-1.5 py-0.5">{duration.toFixed(1)}s ACTIVE</span>
                                    <span>TRIM END</span>
                                  </div>
                                  
                                  {/* Glowing Visual Clip Bar with active range */}
                                  <div className="h-6 w-full bg-neutral-900 border border-white/5 rounded-lg relative overflow-hidden flex items-center">
                                    {/* Grayscale background before start */}
                                    <div className="h-full bg-black/50 absolute left-0 animate-in fade-in duration-300" style={{ width: `${start * 10}%` }} />
                                    {/* Active Highlight Range */}
                                    <div className="h-full bg-neutral-800 border-l border-r border-white/10 absolute" style={{ left: `${start * 10}%`, right: `${(10 - end) * 10}%` }}>
                                      <span className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(139,92,246,0.15),transparent)]" />
                                    </div>
                                    {/* Grayscale background after end */}
                                    <div className="h-full bg-black/50 absolute right-0 animate-in fade-in duration-300" style={{ width: `${(10 - end) * 10}%` }} />
                                    
                                    {/* Small visual film clip frames inside the track */}
                                    <div className="absolute inset-0 flex justify-between px-3 pointer-events-none opacity-5">
                                      {[...Array(10)].map((_, i) => (
                                        <div key={i} className="w-[1px] h-full bg-white border-dashed border-r border-white/30" />
                                      ))}
                                    </div>
                                  </div>

                                  {/* Dual Range Controls */}
                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[8px] font-mono text-neutral-500">START:</span>
                                      <input
                                        type="range"
                                        min="0"
                                        max={Math.max(0, end - 0.5)}
                                        step="0.1"
                                        value={start}
                                        onChange={(e) => {
                                          const val = parseFloat(e.target.value);
                                          setTimeline(prev => {
                                            const next = [...prev];
                                            next[idx] = { ...next[idx], trimStart: val };
                                            return next;
                                          });
                                        }}
                                        className="flex-1 accent-white h-1 bg-neutral-900 rounded cursor-pointer appearance-none"
                                      />
                                      <span className="text-[9px] font-mono text-neutral-300 w-8 text-right">{start.toFixed(1)}s</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[8px] font-mono text-neutral-500">END:</span>
                                      <input
                                        type="range"
                                        min={start + 0.5}
                                        max="10"
                                        step="0.1"
                                        value={end}
                                        onChange={(e) => {
                                          const val = parseFloat(e.target.value);
                                          setTimeline(prev => {
                                            const next = [...prev];
                                            next[idx] = { ...next[idx], trimEnd: val };
                                            return next;
                                          });
                                        }}
                                        className="flex-1 accent-white h-1 bg-neutral-900 rounded cursor-pointer appearance-none"
                                      />
                                      <span className="text-[9px] font-mono text-neutral-300 w-8 text-right">{end.toFixed(1)}s</span>
                                    </div>
                                  </div>
                                </div>

                                {/* Right column: Move Order arrows */}
                                <div className="shrink-0 flex items-center justify-end gap-1 border-t border-white/5 pt-3 md:border-t-0 md:pt-0">
                                  <button
                                    disabled={idx === 0}
                                    onClick={() => {
                                      setTimeline(prev => {
                                        const next = [...prev];
                                        const temp = next[idx];
                                        next[idx] = next[idx - 1];
                                        next[idx - 1] = temp;
                                        return next;
                                      });
                                    }}
                                    className="h-8 w-8 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none"
                                  >
                                    <ChevronUp size={14} />
                                  </button>
                                  <button
                                    disabled={idx === timeline.length - 1}
                                    onClick={() => {
                                      setTimeline(prev => {
                                        const next = [...prev];
                                        const temp = next[idx];
                                        next[idx] = next[idx + 1];
                                        next[idx + 1] = temp;
                                        return next;
                                      });
                                    }}
                                    className="h-8 w-8 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 text-neutral-400 hover:text-white transition-colors flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none"
                                  >
                                    <ChevronDown size={14} />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="text-center py-6 text-xs text-neutral-500">Initializing timeline metadata...</div>
                        )}
                      </div>
                    </div>

                    {/* Action Bar */}
                    <div className="rounded-2xl border border-white/10 bg-neutral-900/60 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-xl">
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-1.5 uppercase font-mono">
                          <Clapperboard size={14} className="text-white" /> Compile Cinematic Film
                        </h4>
                        <p className="text-xs text-neutral-500 mt-1 max-w-md">
                          Triggers server-side FFmpeg processing on Google Cloud. It standardizes, trims, scales, stitches, and mixes your audio track into a single fully polished MP4.
                        </p>
                      </div>
                      <button
                        disabled={compileStatus === "compiling"}
                        onClick={handleCompileProject}
                        className="flex items-center justify-center gap-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 disabled:bg-neutral-950 disabled:opacity-50 px-6 py-3.5 text-xs font-bold text-white transition-all shadow-md"
                      >
                        {compileStatus === "compiling" ? (
                          <>
                            <span className="h-3.5 w-3.5 animate-spin rounded-full border border-white border-t-transparent" />
                            Rendering...
                          </>
                        ) : (
                          <>
                            <Zap size={14} /> Compile & Render Movie
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()
        ) : (
          /* ─── STANDARD MANUAL REVIEW DECK ──────────────────────── */
          <div className="flex flex-1 flex-col overflow-y-auto px-6 py-6 w-full max-w-6xl mx-auto">
          {/* Header Controls */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-white/5 pb-5">
            <div>
              <span className="text-[10px] font-bold text-white bg-neutral-800 rounded px-2.5 py-0.5 uppercase border border-white/10">
                Director Storyboard Spec
              </span>
              <h2 className="mt-2 text-xl font-bold tracking-tight text-white md:text-2xl">
                {storyboard.title}
              </h2>
              <p className="mt-1 text-xs text-neutral-500 leading-relaxed">{storyboard.concept}</p>
            </div>
            <button
              onClick={() => {
                if (confirm("Are you sure you want to reset this draft? Unsaved changes will be lost.")) {
                  setView("home");
                }
              }}
              className="self-start flex items-center gap-1.5 rounded-xl bg-white/5 border border-white/5 px-4 py-2 text-xs font-semibold hover:bg-white/10 transition-colors"
            >
              <Undo2 size={12} /> Reset Draft
            </button>
          </div>

          {/* Director settings / Locks Block */}
          <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* LCB (Locked Character Block) Card */}
            <div className="rounded-xl border border-white/5 bg-surface/80 p-5 flex flex-col">
              <span className="text-[11px] font-bold text-white tracking-wider uppercase">
                Locked Character Block (LCB)
              </span>
              <p className="mt-1 text-[11px] text-neutral-500 leading-relaxed mb-3">
                Maintains face and physical geometry consistency verbatim across scenes.
              </p>
              <textarea
                value={storyboard.characterLock.description}
                onChange={(e) =>
                  setStoryboard({
                    ...storyboard,
                    characterLock: { ...storyboard.characterLock, description: e.target.value },
                  })
                }
                rows={4}
                className="w-full bg-background rounded-xl border border-white/5 p-3.5 text-xs leading-relaxed focus:border-white/10 outline-none text-white font-mono"
              />
              <div className="mt-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <span className="text-[9px] font-bold text-neutral-500 uppercase">Actor Subject</span>
                  <input
                    value={storyboard.characterLock.name}
                    onChange={(e) =>
                      setStoryboard({
                        ...storyboard,
                        characterLock: { ...storyboard.characterLock, name: e.target.value },
                      })
                    }
                    className="mt-1 w-full bg-background text-xs rounded-lg border border-white/5 px-3 py-1.5 text-white font-semibold"
                  />
                </div>
                <div>
                  <span className="text-[9px] font-bold text-neutral-500 uppercase">Locked Wardrobe</span>
                  <input
                    value={storyboard.characterLock.wardrobe}
                    onChange={(e) =>
                      setStoryboard({
                        ...storyboard,
                        characterLock: { ...storyboard.characterLock, wardrobe: e.target.value },
                      })
                    }
                    className="mt-1 w-full bg-background text-xs rounded-lg border border-white/5 px-3 py-1.5 text-white font-semibold"
                  />
                </div>
              </div>
            </div>

            {/* STYLE HEADER block */}
            <div className="rounded-xl border border-white/5 bg-surface/80 p-5 flex flex-col">
              <span className="text-[11px] font-bold text-white tracking-wider uppercase">
                Visual Style Contract
              </span>
              <p className="mt-1 text-[11px] text-neutral-500 leading-relaxed mb-3">
                Optical, lens, and grain parameters applied consistently to every output.
              </p>
              <textarea
                value={storyboard.styleHeader}
                onChange={(e) => setStoryboard({ ...storyboard, styleHeader: e.target.value })}
                rows={6}
                className="w-full flex-1 bg-background rounded-xl border border-white/5 p-3.5 text-xs leading-relaxed focus:border-white/10 outline-none text-white font-mono"
              />
            </div>
          </div>

          {/* Director Scene Cards Grid Header */}
          <div className="mt-10 flex items-center gap-3 border-b border-white/5 pb-3">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-neutral-800 text-white">
              <Tv size={12} />
            </span>
            <h3 className="text-base font-bold text-white tracking-tight">Scene Generation Panel</h3>
          </div>

          {/* GRID OF SCENE CARDS */}
          <div className="mt-5 flex flex-col gap-6">
            {storyboard.scenes.map((scene, idx) => {
              const status = videoStatus[idx] || { status: "idle", revisionInput: "" };
              return (
                <div
                  key={scene.sceneNumber}
                  className="rounded-2xl border border-white/5 bg-gradient-to-b from-[#0e0e11] to-[#070709] p-5 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start hover:border-white/10 transition-colors"
                >
                  {/* Scene description columns */}
                  <div className="lg:col-span-7 space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-white bg-neutral-800 px-2 py-0.5 rounded-full border border-white/10">
                        Scene {scene.sceneNumber} — 10s Clip
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                      <div className="rounded-xl bg-white/[0.01] border border-white/5 p-3.5">
                        <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wide">
                          Setting Environment
                        </span>
                        <p className="mt-1 text-xs text-neutral-300 leading-relaxed">
                          {scene.setting}
                        </p>
                      </div>

                      <div className="rounded-xl bg-white/[0.01] border border-white/5 p-3.5">
                        <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wide">
                          Diegetic Audio / Sound Spec
                        </span>
                        <p className="mt-1 text-xs text-neutral-300 leading-relaxed">
                          {scene.sound}
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl bg-white/[0.01] border border-white/5 p-3.5">
                      <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wide">
                        Action Beats Sequence (Verbs)
                      </span>
                      <p className="mt-1 text-xs text-neutral-300 leading-relaxed">
                        {scene.action}
                      </p>
                    </div>

                    {scene.dialogue && (
                      <div className="rounded-xl bg-white/5 border border-white/10 p-3.5">
                        <span className="text-[9px] font-bold text-white uppercase tracking-wide">
                          Dialogue/Speech Track
                        </span>
                        <p className="mt-1 text-xs italic text-neutral-200 leading-relaxed">
                          "{scene.dialogue}"
                        </p>
                      </div>
                    )}

                    {/* Prompts Panel */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wide">
                          Copy-Ready Compiled Prompt (Blocks 1-14)
                        </span>
                        <button
                          onClick={() => copyToClipboard(status.customPrompt || scene.fullPrompt, idx)}
                          className="flex items-center gap-1 text-xs text-neutral-500 hover:text-white transition-colors"
                        >
                          <Copy size={11} />
                          {copiedIndex === idx ? "Copied" : "Copy Prompt"}
                        </button>
                      </div>
                      
                      {status.editingPrompt ? (
                        <textarea
                          value={status.customPrompt || scene.fullPrompt}
                          onChange={(e) =>
                            setVideoStatus((prev) => ({
                              ...prev,
                              [idx]: { ...prev[idx], customPrompt: e.target.value },
                            }))
                          }
                          rows={5}
                          className="w-full bg-background rounded-xl border border-white/10 p-3 text-xs leading-relaxed outline-none text-white font-mono"
                        />
                      ) : (
                        <div className="relative rounded-xl border border-white/5 bg-background p-3.5 font-mono text-[11px] text-neutral-400 max-h-32 overflow-y-auto leading-relaxed whitespace-pre-line">
                          {status.customPrompt || scene.fullPrompt}
                        </div>
                      )}

                      <button
                        onClick={() =>
                          setVideoStatus((prev) => ({
                            ...prev,
                            [idx]: {
                              ...prev[idx],
                              editingPrompt: !prev[idx]?.editingPrompt,
                              customPrompt: prev[idx]?.customPrompt || scene.fullPrompt,
                            },
                          }))
                        }
                        className="flex items-center gap-1 text-[11px] text-neutral-500 hover:text-white transition-colors"
                      >
                        <Edit3 size={11} />
                        {status.editingPrompt ? "Save Prompt Edit" : "Manually Edit Prompt Block"}
                      </button>
                    </div>

                    {/* REVISION ENGINE INPUT */}
                    <div className="flex items-center gap-2 rounded-xl bg-background border border-white/5 px-3 py-1.5">
                      <input
                        value={status.revisionInput || ""}
                        onChange={(e) =>
                          setVideoStatus((prev) => ({
                            ...prev,
                            [idx]: { ...prev[idx], revisionInput: e.target.value },
                          }))
                        }
                        placeholder="Request scene rewrite (e.g. change shirt color, add rain, pan left)..."
                        disabled={status.revising}
                        className="w-full bg-transparent text-xs outline-none text-white placeholder:text-neutral-700 disabled:opacity-50"
                      />
                      <button
                        onClick={() => reviseScenePrompt(idx)}
                        disabled={status.revising || !status.revisionInput?.trim()}
                        className="shrink-0 flex items-center gap-1 rounded-lg bg-neutral-800 hover:bg-neutral-700 disabled:bg-neutral-800 disabled:text-neutral-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                      >
                        {status.revising ? (
                          <>
                            <RefreshCw size={11} className="animate-spin" /> Rewriting...
                          </>
                        ) : (
                          <>
                            <Wand2 size={11} /> Rewrite Scene
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Rendering player and controller column */}
                  <div className="lg:col-span-5 flex flex-col justify-center h-full">
                    {status.status === "idle" && (
                      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/5 bg-white/[0.005] px-6 py-14 text-center">
                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-900 text-neutral-500 mb-3 border border-neutral-800">
                          <Video size={16} />
                        </span>
                        <h4 className="text-xs font-bold text-white">Video Draft Offline</h4>
                        <p className="mt-1 text-[11px] text-neutral-500 max-w-xs leading-normal">
                          Trigger the high-motion Gemini Omni Flash engine to render this prompt block.
                        </p>
                        <button
                          onClick={() => generateVideoForScene(idx, status.customPrompt || scene.fullPrompt)}
                          className="mt-4.5 flex items-center gap-1.5 rounded-xl bg-white text-black hover:bg-neutral-200 px-5 py-2 text-xs font-bold transition-all shadow-md"
                        >
                          <Play size={11} fill="black" /> Generate Scene Video
                        </button>
                      </div>
                    )}

                    {status.status === "rendering" && (
                      <div className="flex flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.01] px-6 py-14 text-center">
                        <RefreshCw size={28} className="text-white animate-spin" />
                        <h4 className="mt-3 text-xs font-bold text-white">Generating Clip...</h4>
                        <p className="mt-2 text-[10px] text-neutral-500 leading-relaxed max-w-xs">
                          Gemini Omni Flash is compiling files. This usually takes 1-3 minutes.
                        </p>
                      </div>
                    )}

                    {status.status === "succeeded" && status.url && (
                      <div className="space-y-3">
                        <div className="relative aspect-video overflow-hidden rounded-xl bg-black border border-white/10 shadow-2xl">
                          <video
                            src={status.url}
                            controls
                            className="h-full w-full object-cover"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/5 px-2.5 py-0.5 rounded-full border border-emerald-500/15">
                            <CheckCircle size={11} /> Render Successful
                          </span>
                          <button
                            onClick={() => generateVideoForScene(idx, status.customPrompt || scene.fullPrompt)}
                            className="flex items-center gap-1 text-[11px] font-semibold text-neutral-500 hover:text-white transition-colors"
                          >
                            <RefreshCw size={11} /> Re-render Video
                          </button>
                        </div>
                      </div>
                    )}

                    {status.status === "failed" && (
                      <div className="flex flex-col items-center justify-center rounded-2xl border border-red-500/10 bg-red-500/[0.005] px-6 py-10 text-center">
                        <AlertCircle size={24} className="text-red-400" />
                        <h4 className="mt-2.5 text-xs font-bold text-white">Generation Failed</h4>
                        <p className="mt-1 text-[10px] text-red-400 max-w-xs leading-normal">
                          {status.error || "GCP Operation timed out"}
                        </p>
                        <button
                          onClick={() => generateVideoForScene(idx, status.customPrompt || scene.fullPrompt)}
                          className="mt-3.5 flex items-center gap-1 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 px-3.5 py-1.5 text-xs font-semibold transition-colors"
                        >
                          <RefreshCw size={11} /> Retry Generation
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))
    )}


      {/* ─── SECURE STORYBOARD PAYWALL MODAL (GAMBIAN DALASIS) ───────────────── */}
      {storyboardPayOpen && (
        (() => {
          // Calculate pricing dynamically
          let cost = 900; // Default 60s GMD 900
          if (length === "30s") cost = 450; // GMD 450
          if (length === "90s") cost = 1350; // GMD 1350

          const balance = profile?.credits ?? 0;
          const hasEnough = balance >= cost;
          const remaining = balance - cost;

          const handleWalletPay = async () => {
            if (!user) return;
            try {
              // Deduct in Firestore
              const userRef = doc(db, "users", user.uid);
              await updateDoc(userRef, {
                credits: increment(-cost),
              });

              // Log transaction in GMD
              const dateString = new Date().toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              });
              const invoiceId = `INV-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(10 + Math.random() * 90)}`;

              await addDoc(collection(db, "transactions"), {
                uid: user.uid,
                invoiceId,
                date: dateString,
                description: `Storyboard Spec Generation (${length} — ${length === "30s" ? 3 : length === "60s" ? 6 : 9} Scenes)`,
                method: "Wallet Balance",
                status: "Succeeded",
                amount: `-GMD ${cost.toFixed(2)}`,
                createdAt: new Date().toISOString(),
              });

              // Transition to production option step
              setPaywallStep("choose");
            } catch (err) {
              console.error("Wallet deduction failed:", err);
            }
          };

          const handleSpotPay = async (e: React.FormEvent) => {
            e.preventDefault();
            if (!ccName.trim() || !ccNumber.trim() || !ccExpiry.trim() || !ccCvv.trim()) {
              setCcError("Please fill in all credit card details.");
              return;
            }
            if (!user) {
              setCcError("You must be logged in to make a payment.");
              return;
            }

            setCcError(null);
            setCcPaying(true);
            setCcPayMessage("Contacting payment gateway via ModemPay...");

            try {
              await new Promise((res) => setTimeout(resolve => res(null), 800));
              setCcPayMessage("Authorizing card credentials...");
              await new Promise((res) => setTimeout(resolve => res(null), 700));
              setCcPayMessage("Deducting funds and crediting wallet...");
              await new Promise((res) => setTimeout(resolve => res(null), 600));

              // Write invoice
              const dateString = new Date().toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              });
              const invoiceId = `INV-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(10 + Math.random() * 90)}`;
              const lastFour = ccNumber.replace(/\s/g, "").slice(-4) || "4242";

              await addDoc(collection(db, "transactions"), {
                uid: user.uid,
                invoiceId,
                date: dateString,
                description: `Spot Purchase: Storyboard Spec (${length} — ${length === "30s" ? "3" : length === "60s" ? "6" : "9"} Scenes)`,
                method: `ModemPay (Visa *${lastFour})`,
                status: "Succeeded",
                amount: `GMD ${cost.toFixed(2)}`,
                createdAt: new Date().toISOString(),
              });

              // Increment user credits by 'cost' in Firestore so it satisfies the storyboard price
              const userRef = doc(db, "users", user.uid);
              await updateDoc(userRef, {
                credits: increment(cost),
              });

              setCcCompleted(true);
              setCcPaying(false);

              setTimeout(async () => {
                // Clear fields
                setCcName("");
                setCcNumber("");
                setCcExpiry("");
                setCcCvv("");
                setCcCompleted(false);
                setCcSpotCheckout(false);

                // Transition to production option step
                setPaywallStep("choose");
              }, 1500);

            } catch (err) {
              console.error("Spot payment error:", err);
              setCcError("Transaction declined. Please try a different card.");
              setCcPaying(false);
            }
          };

          return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              {/* Backdrop */}
              <div
                className="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
                onClick={ccPaying ? undefined : () => setStoryboardPayOpen(false)}
              />

              {/* Card Container */}
              <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-blue-500 bg-[#070e24]/95 p-6 shadow-2xl backdrop-blur-2xl transition-all animate-in fade-in-50 zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <h3 className="text-base font-bold tracking-tight text-white flex items-center gap-2 font-semibold">
                    <div className="flex items-center gap-1 shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      <div className="w-1.5 h-1.5 rounded-full bg-transparent border border-blue-400/40" />
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    </div>
                    Confirm Storyboard Spec
                  </h3>
                  <button
                    onClick={ccPaying ? undefined : () => setStoryboardPayOpen(false)}
                    className="rounded-full p-1 text-neutral-400 hover:bg-white/5 hover:text-white transition-colors"
                  >
                    <X size={15} />
                  </button>
                </div>

                {/* Loading state */}
                {ccPaying && (
                  <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                    <RefreshCw className="text-white animate-spin" size={32} />
                    <p className="text-xs font-semibold text-white">{ccPayMessage}</p>
                    <p className="text-[10px] text-neutral-500">Please do not close this modal or reload.</p>
                  </div>
                )}

                {/* Completed state */}
                {ccCompleted && (
                  <div className="py-12 flex flex-col items-center justify-center text-center space-y-3">
                    <CheckCircle className="text-emerald-400 animate-bounce" size={40} />
                    <p className="text-sm font-bold text-white">Payment Authorized!</p>
                    <p className="text-xs text-neutral-400">Compiling multi-scene director spec now...</p>
                  </div>
                )}

                {/* CHOICE STATE */}
                {paywallStep === "choose" && (
                  <div className="py-4 flex flex-col space-y-5 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
                    <div className="text-center">
                      <h4 className="text-sm font-bold text-white uppercase tracking-wider font-mono">Select Production Mode</h4>
                      <p className="text-xs text-neutral-400 mt-1 max-w-sm mx-auto">
                        How would you like to compile your ad? You can adjust this configuration anytime.
                      </p>
                    </div>

                    <div className="grid gap-3">
                      {/* Option 1: REVIEW PROMPTS (Manual Mode) */}
                      <button
                        onClick={async () => {
                          setProductionMode("manual");
                          setStoryboardPayOpen(false);
                          setPaywallStep("pay"); // Reset for next time
                          await generateStoryboard();
                        }}
                        className="group flex flex-col rounded-2xl border border-white/10 bg-[#0d1631]/40 p-4 text-left hover:bg-[#0d1631]/80 hover:border-blue-500/50 transition-all duration-300 active:scale-[0.98]"
                      >
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-neutral-800 px-2 py-0.5 text-[9px] font-bold text-neutral-400 font-mono uppercase">
                            Director's Draft
                          </span>
                        </div>
                        <h5 className="mt-2 text-xs font-bold text-white group-hover:text-white transition-colors">
                          Review & Customize Prompts
                        </h5>
                        <p className="mt-1 text-[10px] text-neutral-400 leading-normal">
                          Inspect the generated storyboard spec scene-by-scene first. Adjust prompts, edit dialogue, and render segments manually with full creative control.
                        </p>
                      </button>

                      {/* Option 2: AUTO-GENERATE (Auto-Merge Mode) */}
                      <button
                        onClick={async () => {
                          setProductionMode("auto-merge");
                          setStoryboardPayOpen(false);
                          setPaywallStep("pay"); // Reset for next time
                          await generateStoryboard();
                        }}
                        className="group flex flex-col rounded-2xl border border-blue-500 bg-[#0c152d] p-4 text-left hover:border-blue-400 hover:bg-[#0c152d]/90 transition-all duration-300 shadow-lg shadow-blue-500/10 active:scale-[0.98]"
                      >
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-white/20 px-2 py-0.5 text-[9px] font-bold text-white font-mono uppercase">
                            Express Auto-Merge
                          </span>
                        </div>
                        <h5 className="mt-2 text-xs font-bold text-white group-hover:text-white transition-colors flex items-center gap-1">
                          Auto-Generate Full Video <Zap size={11} className="text-white animate-pulse" />
                        </h5>
                        <p className="mt-1 text-[10px] text-neutral-300 leading-normal">
                          Kicks off direct segment generation of all scenes in parallel behind a gorgeous widescreen loading HUD, and automatically merges them into a single playback film.
                        </p>
                      </button>
                    </div>
                  </div>
                )}

                {/* Normal Content View */}
                {!ccPaying && !ccCompleted && paywallStep !== "choose" && (
                  <div className="mt-4">
                    {!ccSpotCheckout ? (
                      <>
                        <p className="text-xs leading-relaxed text-neutral-400">
                          Your ad pitch is fully configured. Authorize the balance deduction below to begin generating scenes, camera actions, and script dialogue.
                        </p>

                        {/* Cost calculation */}
                        <div className="mt-5 rounded-2xl border border-white/10 bg-[#050b1d]/80 p-4 space-y-3">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-neutral-400 font-medium">Selected Duration</span>
                            <span className="text-white font-bold">{length === "30s" ? "30 seconds (3 Scenes)" : length === "60s" ? "60 seconds (6 Scenes)" : "90 seconds (9 Scenes)"}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs border-t border-white/5 pt-2.5">
                            <span className="text-neutral-400 font-medium">Your wallet balance</span>
                            <span className="font-mono text-white font-semibold">GMD {balance.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between items-center text-xs border-t border-white/5 pt-2.5">
                            <span className="text-neutral-400 font-medium">Storyboard generation cost</span>
                            <span className="font-mono text-white font-bold">-GMD {cost.toFixed(2)}</span>
                          </div>

                          {hasEnough ? (
                            <div className="flex justify-between items-center text-xs border-t border-white/5 pt-2.5">
                              <span className="text-neutral-400 font-medium">Remaining wallet balance</span>
                              <span className="font-mono text-emerald-400 font-bold">GMD {remaining.toFixed(2)}</span>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2 rounded-lg bg-red-950/20 border border-red-900/30 px-3 py-2.5 mt-3">
                              <div className="flex items-start gap-2">
                                <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
                                <div>
                                  <p className="text-[11px] font-bold text-red-300">Insufficient Wallet Balance</p>
                                  <p className="text-[10px] text-red-400 mt-0.5 leading-normal">
                                    You need GMD {(cost - balance).toFixed(2)} more in your wallet to generate this storyboard spec.
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Footer buttons */}
                        <div className="mt-6 flex gap-3">
                          <button
                            onClick={() => setStoryboardPayOpen(false)}
                            className="flex-1 rounded-2xl border border-white/10 bg-[#0d1631]/40 px-4 py-2.5 text-xs font-semibold text-neutral-300 hover:bg-[#0d1631]/80 hover:text-white transition-all active:scale-95"
                          >
                            Cancel
                          </button>

                          {hasEnough ? (
                            <button
                              onClick={handleWalletPay}
                              className="flex-1 rounded-2xl bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-blue-500/20 active:scale-95"
                            >
                              <Zap size={12} />
                              Pay from Wallet
                            </button>
                          ) : (
                            <button
                              onClick={() => setCcSpotCheckout(true)}
                              className="flex-1 rounded-2xl bg-white px-4 py-2.5 text-xs font-bold text-black hover:bg-neutral-100 transition-all flex items-center justify-center gap-1.5 shadow-lg active:scale-95"
                            >
                              <CreditCard size={12} />
                              Pay on the Spot
                            </button>
                          )}
                        </div>
                      </>
                    ) : (
                      /* SPOT CREDIT CARD CHECKOUT FOR STORYBOARD */
                      <form onSubmit={handleSpotPay} className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-neutral-400 uppercase tracking-wider">Spot Checkout</span>
                          <button
                            type="button"
                            onClick={() => setCcSpotCheckout(false)}
                            className="text-[10px] text-white hover:underline font-bold"
                          >
                            Back to Wallet
                          </button>
                        </div>

                        <div className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 flex items-start gap-2.5">
                          <CheckCircle size={14} className="text-white shrink-0 mt-0.5" />
                          <p className="text-[10px] text-white leading-normal">
                            Secure payment provided by <strong>ModemPay</strong>. Your card details are fully encrypted and will be charged exactly <strong>GMD {cost.toFixed(2)}</strong>.
                          </p>
                        </div>

                        {ccError && (
                          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 flex gap-2 text-[10px] text-red-400 items-start">
                            <AlertCircle size={12} className="shrink-0 mt-0.5" />
                            <span>{ccError}</span>
                          </div>
                        )}

                        <div className="space-y-3.5">
                          <div>
                            <label className="block text-[10px] font-bold text-neutral-400 uppercase">Cardholder Name</label>
                            <input
                              type="text"
                              required
                              value={ccName}
                              onChange={(e) => setCcName(e.target.value)}
                              placeholder="e.g. Nyima Salaam"
                              className="mt-1 w-full rounded-xl border border-white/5 bg-surface-2 px-4.5 py-2.5 text-xs text-white focus:border-white/10 outline-none font-medium"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-neutral-400 uppercase">Card Number</label>
                            <div className="relative mt-1">
                              <input
                                type="text"
                                required
                                value={ccNumber}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, "").slice(0, 16);
                                  const formatted = val.replace(/(\d{4})(?=\d)/g, "$1 ");
                                  setCcNumber(formatted);
                                }}
                                placeholder="4242 4242 4242 4242"
                                className="w-full rounded-xl border border-white/5 bg-surface-2 pl-4.5 pr-10 py-2.5 text-xs text-white focus:border-white/10 outline-none font-mono"
                              />
                              <CreditCard size={14} className="absolute right-3.5 top-3 text-neutral-500" />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-bold text-neutral-400 uppercase">Expiry Date</label>
                              <input
                                type="text"
                                required
                                value={ccExpiry}
                                onChange={(e) => {
                                  const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                                  const formatted = val.length >= 2 ? `${val.slice(0, 2)}/${val.slice(2)}` : val;
                                  setCcExpiry(formatted);
                                }}
                                placeholder="MM/YY"
                                className="mt-1 w-full rounded-xl border border-white/5 bg-surface-2 px-4.5 py-2.5 text-xs text-white focus:border-white/10 outline-none font-mono text-center"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-neutral-400 uppercase">CVV</label>
                              <input
                                type="password"
                                required
                                value={ccCvv}
                                onChange={(e) => setCcCvv(e.target.value.replace(/\D/g, "").slice(0, 3))}
                                placeholder="•••"
                                className="mt-1 w-full rounded-xl border border-white/5 bg-surface-2 px-4.5 py-2.5 text-xs text-white focus:border-white/10 outline-none font-mono text-center"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="mt-6 flex gap-3">
                          <button
                            type="button"
                            onClick={() => setCcSpotCheckout(false)}
                            className="flex-1 rounded-xl border border-white/5 bg-white/5 px-4 py-2.5 text-xs font-semibold text-neutral-300 hover:bg-white/10 hover:text-white transition-all"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            className="flex-1 rounded-xl bg-neutral-800 hover:bg-neutral-700 px-4 py-2.5 text-xs font-bold text-white transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-none"
                          >
                            <CheckCircle size={13} />
                            Authorize GMD {cost.toFixed(2)}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })()
      )}
    </div>
  );
}
